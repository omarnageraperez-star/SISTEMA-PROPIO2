from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.inventory.models import Product, Kardex, Warehouse
from apps.sales.models import Sale, SaleDetail, Payment, PaymentMethod
from apps.billing.models import DIANResolution
from .models import Quotation, StockReservation
from .services import log_quotation_event, get_available_stock

def validate_quotation_for_conversion(quotation):
    """
    Compara los precios y el stock físico actual contra lo cotizado originalmente.
    Devuelve un diccionario con advertencias de diferencias detectadas sin bloquear.
    """
    warnings = []
    has_stock_issues = False
    price_changed_items = []
    warehouse = quotation.warehouse or Warehouse.objects.first()

    for item in quotation.items.all():
        if item.product:
            current_product = item.product
            # Validar stock físico
            if current_product.has_inventory_control:
                # Si tenía reserva propia activa, el stock disponible para esta cotización incluye su reserva
                own_reservation = StockReservation.objects.filter(
                    quotation=quotation,
                    product=current_product,
                    status='ACTIVE'
                ).first()
                reserved_for_me = own_reservation.quantity if own_reservation else Decimal('0.00')
                avail = get_available_stock(current_product, warehouse) + reserved_for_me

                if avail < item.quantity:
                    has_stock_issues = True
                    warnings.append({
                        'type': 'STOCK_INSUFFICIENT',
                        'item_id': item.id,
                        'product_name': item.name,
                        'requested': float(item.quantity),
                        'available': float(avail),
                        'message': f"Stock insuficiente para '{item.name}': Solicitado {item.quantity}, Disponible {avail}"
                    })

            # Validar cambios de precio de lista
            if current_product.price_sell != item.unit_price:
                price_changed_items.append({
                    'item_id': item.id,
                    'product_name': item.name,
                    'quoted_price': float(item.unit_price),
                    'current_price': float(current_product.price_sell),
                    'difference': float(current_product.price_sell - item.unit_price)
                })

    return {
        'can_convert': not (has_stock_issues and not quotation.has_stock_reservation),
        'has_stock_issues': has_stock_issues,
        'warnings': warnings,
        'price_changed_items': price_changed_items
    }


def convert_quotation_to_sale(quotation, user, payment_method_id=None, amount_received=None, line_item_ids=None):
    """
    Convierte atómicamente una cotización a una Venta POS real (Sale + SaleDetail).
    Soporta conversión total o parcial (line_item_ids).
    Reutiliza la lógica estándar de descuento de inventario, Kardex y resolución DIAN.
    """
    if quotation.status in ('CONVERTED', 'CANCELLED', 'EXPIRED'):
        raise ValueError(f"No se puede convertir una cotización en estado {quotation.get_status_display()}.")

    with transaction.atomic():
        warehouse = quotation.warehouse
        if not warehouse:
            warehouse, _ = Warehouse.objects.get_or_create(
                name='Bodega Principal',
                defaults={'location': 'Central'}
            )

        # 1. Resolver o crear Venta (Sale)
        sale = Sale.objects.create(
            user=user if user and user.is_authenticated else quotation.user,
            customer=quotation.customer,
            warehouse=warehouse,
            status='COMPLETED',
            invoice_type='POS',
            subtotal=Decimal('0.00'),
            tax=Decimal('0.00'),
            discount=Decimal('0.00'),
            total=Decimal('0.00')
        )

        # 2. Asignar consecutivo de factura según resolución DIAN (con select_for_update para prevenir colisiones)
        resolution = DIANResolution.objects.filter(
            resolution_type='POS',
            is_active=True
        ).select_for_update().first()

        if resolution:
            if resolution.current_number == 0:
                next_number = resolution.start_range
            else:
                next_number = resolution.current_number + 1

            if next_number <= resolution.end_range:
                resolution.current_number = next_number
                resolution.save(update_fields=['current_number'])
                prefix = resolution.prefix or ''
                sale.invoice_number = f"{prefix}{next_number}"
            else:
                sale.invoice_number = f"TEMP-POS-{sale.id}"
        else:
            sale.invoice_number = f"COT-VTA-{sale.id}"

        # 3. Procesar ítems a facturar (filtrados por line_item_ids si es conversión parcial)
        items_query = quotation.items.all()
        if line_item_ids:
            items_query = items_query.filter(id__in=line_item_ids)

        accum_subtotal = Decimal('0.00')
        accum_tax = Decimal('0.00')
        accum_discount = Decimal('0.00')

        for item in items_query:
            product = item.product
            # Si es ítem manual libre (servicio, mano de obra, flete), asociar a producto genérico de servicio
            if not product or item.is_manual:
                product, _ = Product.objects.get_or_create(
                    internal_code='SERV-MANUAL',
                    defaults={
                        'name': item.name[:200],
                        'description': 'Servicio o ítem libre de cotización',
                        'measurement_unit': item.measurement_unit or 'Servicio',
                        'has_inventory_control': False,
                        'price_sell': item.unit_price,
                        'price_buy': item.unit_cost,
                    }
                )

            # Verificar y descontar stock si tiene control de inventario
            if product.has_inventory_control:
                if product.stock < item.quantity:
                    raise ValueError(f"Stock insuficiente para facturar '{product.name}'. Existencia actual: {product.stock}, requerida: {item.quantity}")
                
                product.stock -= item.quantity
                product.save()

                # Registrar salida en Kardex
                Kardex.objects.create(
                    product=product,
                    warehouse=warehouse,
                    movement_type='OUT',
                    quantity=item.quantity,
                    reference=f"Venta {sale.invoice_number} (Cot. {quotation.consecutive})"
                )

            # Crear SaleDetail
            line_subtotal = (item.quantity * item.unit_price) + item.extras_amount - item.discount_amount
            SaleDetail.objects.create(
                sale=sale,
                product=product,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=item.discount_amount,
                subtotal=line_subtotal
            )

            accum_subtotal += (item.quantity * item.unit_price) + item.extras_amount
            accum_discount += item.discount_amount
            accum_tax += item.tax_amount

            # Descontar stock de adicionales que tengan insumos vinculados
            for extra in item.extras.all():
                if extra.product and extra.deduct_stock and extra.product.has_inventory_control:
                    extra_qty = extra.quantity * item.quantity
                    if extra.product.stock >= extra_qty:
                        extra.product.stock -= extra_qty
                        extra.product.save()
                        Kardex.objects.create(
                            product=extra.product,
                            warehouse=warehouse,
                            movement_type='OUT',
                            quantity=extra_qty,
                            reference=f"Adicional Venta {sale.invoice_number}"
                        )

        # Aplicar descuento global proporcional si existe
        if quotation.discount_amount > 0 and quotation.subtotal > 0:
            prop_discount = (accum_subtotal / quotation.subtotal) * quotation.discount_amount
            accum_discount += prop_discount

        sale_total = max(Decimal('0.00'), accum_subtotal - accum_discount + accum_tax + quotation.additional_charges)
        sale.subtotal = accum_subtotal
        sale.tax = accum_tax
        sale.discount = accum_discount
        sale.total = sale_total
        sale.save()

        # 4. Registrar Pago
        pm = None
        if payment_method_id:
            pm = PaymentMethod.objects.filter(id=payment_method_id).first()
        if not pm:
            pm, _ = PaymentMethod.objects.get_or_create(name='Efectivo')

        received = Decimal(str(amount_received)) if amount_received else sale_total
        Payment.objects.create(
            sale=sale,
            payment_method=pm,
            amount=sale_total,
            reference=f"Cotización {quotation.consecutive}"
        )

        # 5. Consumir reservas de inventario
        quotation.stock_reservations.filter(status='ACTIVE').update(status='CONSUMED')

        # 6. Actualizar estado de la cotización
        # Si fue conversión parcial y quedan ítems, se mantiene en estado Aprobada/Parcial, sino CONVERTED
        is_partial = line_item_ids is not None and len(line_item_ids) < quotation.items.count()
        if not is_partial:
            quotation.status = 'CONVERTED'
        quotation.converted_at = timezone.now()
        quotation.sale = sale
        quotation.has_stock_reservation = False
        quotation.save(update_fields=['status', 'converted_at', 'sale', 'has_stock_reservation', 'updated_at'])

        log_quotation_event(
            quotation,
            user,
            'CONVERT',
            f"Cotización convertida en Venta {sale.invoice_number} por un total de ${sale.total}"
        )

        return sale
