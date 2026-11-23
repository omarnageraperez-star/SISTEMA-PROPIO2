from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from apps.users.models import SystemSetting
from apps.inventory.models import Product, Stock, Warehouse
from .models import (
    Quotation, QuotationItem, QuotationItemExtra, QuotationItemCustomization,
    QuotationConfiguration, StockReservation, QuotationAuditLog
)

def get_currency_config():
    """Obtiene el símbolo y decimales configurados globalmente en el sistema"""
    symbol_setting = SystemSetting.objects.filter(key='currency_symbol').first()
    decimals_setting = SystemSetting.objects.filter(key='currency_decimals').first()
    symbol = symbol_setting.value if symbol_setting and symbol_setting.value else '$'
    try:
        decimals = int(decimals_setting.value) if decimals_setting and decimals_setting.value.isdigit() else 2
    except Exception:
        decimals = 2
    return symbol, decimals


def round_currency(value, decimals=2):
    """Redondea un monto Decimal de acuerdo a los decimales configurados"""
    if value is None:
        return Decimal('0.00')
    val = Decimal(str(value))
    exp = Decimal('10') ** -decimals
    return val.quantize(exp, rounding=ROUND_HALF_UP)


def get_available_stock(product, warehouse=None):
    """
    Calcula el stock disponible en tiempo real:
    Stock Disponible = Stock Físico - Stock Reservado Activo
    """
    if not product.has_inventory_control:
        return Decimal('999999.00')
    
    physical_stock = product.stock or Decimal('0.00')
    
    # Sumar reservas activas y no vencidas
    now = timezone.now()
    active_reservations = StockReservation.objects.filter(
        product=product,
        status='ACTIVE',
        expires_at__gt=now
    )
    if warehouse:
        active_reservations = active_reservations.filter(warehouse=warehouse)
        
    reserved_qty = sum(r.quantity for r in active_reservations)
    available = physical_stock - reserved_qty
    return max(Decimal('0.00'), available)


def generate_next_consecutive():
    """Genera el siguiente número consecutivo de manera segura ante concurrencia"""
    with transaction.atomic():
        config = QuotationConfiguration.objects.select_for_update().get_or_create(id=1)[0]
        prefix = config.consecutive_prefix or 'COT-'
        num = config.next_number
        year_str = f"{timezone.now().year}-" if config.consecutive_include_year else ""
        
        consecutive = f"{prefix}{year_str}{num:04d}"
        
        # Verificar que sea único en caso de saltos
        while Quotation.objects.filter(consecutive=consecutive).exists():
            num += 1
            consecutive = f"{prefix}{year_str}{num:04d}"
            
        config.next_number = num + 1
        config.save(update_fields=['next_number'])
        return consecutive


def log_quotation_event(quotation, user, action, description, changes=None):
    """Crea un registro de auditoría para la cotización"""
    return QuotationAuditLog.objects.create(
        quotation=quotation,
        user=user if user and user.is_authenticated else None,
        action=action,
        description=description,
        changes=changes or {}
    )


def calculate_item_totals(item_data, decimals=2):
    """
    Calcula los totales de una línea individual con sus adicionales y personalizaciones.
    """
    quantity = Decimal(str(item_data.get('quantity', 1)))
    unit_price = Decimal(str(item_data.get('unit_price', 0)))
    unit_cost = Decimal(str(item_data.get('unit_cost', 0)))
    
    # 1. Personalizaciones que impactan el precio base
    customizations_data = item_data.get('customizations', [])
    adjusted_unit_price = unit_price
    for c in customizations_data:
        impact_type = c.get('impact_type', 'NONE')
        impact_val = Decimal(str(c.get('impact_value', 0)))
        if impact_type == 'ADD':
            adjusted_unit_price += impact_val
        elif impact_type == 'SUBTRACT':
            adjusted_unit_price = max(Decimal('0.00'), adjusted_unit_price - impact_val)
        elif impact_type == 'MULTIPLY' and impact_val > 0:
            adjusted_unit_price = adjusted_unit_price * impact_val

    base_line_amount = quantity * adjusted_unit_price

    # 2. Adicionales / Extras
    extras_data = item_data.get('extras', [])
    extras_total = Decimal('0.00')
    calculated_extras = []
    for ex in extras_data:
        ex_type = ex.get('price_type', 'FIXED')
        ex_rate = Decimal(str(ex.get('rate', 0)))
        ex_qty = Decimal(str(ex.get('quantity', 1)))
        
        if ex_type == 'FIXED':
            ex_price = ex_rate * ex_qty
        elif ex_type == 'PER_UNIT':
            ex_price = ex_rate * quantity * ex_qty
        elif ex_type == 'PERCENTAGE':
            ex_price = (base_line_amount * (ex_rate / Decimal('100.0'))) * ex_qty
        else:
            ex_price = ex_rate * ex_qty
            
        ex_price = round_currency(ex_price, decimals)
        extras_total += ex_price
        calculated_extras.append({
            **ex,
            'rate': ex_rate,
            'quantity': ex_qty,
            'total_price': ex_price
        })

    # 3. Descuento de línea
    discount_type = item_data.get('discount_type', 'PERCENTAGE')
    discount_rate = Decimal(str(item_data.get('discount_rate', 0)))
    discount_amount = Decimal('0.00')
    
    gross_line = base_line_amount + extras_total
    if discount_type == 'PERCENTAGE':
        discount_amount = gross_line * (discount_rate / Decimal('100.0'))
    else:
        discount_amount = Decimal(str(item_data.get('discount_amount', discount_rate)))
        
    discount_amount = min(gross_line, round_currency(discount_amount, decimals))
    subtotal = gross_line - discount_amount

    # 4. Impuesto de línea
    tax_percent = Decimal(str(item_data.get('tax_percent', 0)))
    tax_amount = round_currency(subtotal * (tax_percent / Decimal('100.0')), decimals)
    total = subtotal + tax_amount

    return {
        'quantity': quantity,
        'unit_cost': round_currency(unit_cost, decimals),
        'unit_price': round_currency(adjusted_unit_price, decimals),
        'discount_type': discount_type,
        'discount_rate': discount_rate,
        'discount_amount': round_currency(discount_amount, decimals),
        'tax_percent': tax_percent,
        'tax_amount': round_currency(tax_amount, decimals),
        'extras_amount': round_currency(extras_total, decimals),
        'subtotal': round_currency(subtotal, decimals),
        'total': round_currency(total, decimals),
        'calculated_extras': calculated_extras,
    }


def calculate_quotation_totals(quotation_data, items_data, decimals=2):
    """
    Calcula los totales completos de la cotización:
    Subtotal acumulado de líneas, descuento global, impuestos, adicionales globales y total general.
    """
    gross_subtotal = Decimal('0.00')
    accum_taxes = Decimal('0.00')
    accum_line_discounts = Decimal('0.00')
    processed_items = []

    for idx, item in enumerate(items_data):
        item_calc = calculate_item_totals(item, decimals)
        gross_subtotal += item_calc['subtotal']
        accum_taxes += item_calc['tax_amount']
        accum_line_discounts += item_calc['discount_amount']
        processed_items.append({
            'item_data': item,
            'calc': item_calc,
            'order_index': idx
        })

    # Descuento global
    disc_type = quotation_data.get('discount_type', 'PERCENTAGE')
    disc_rate = Decimal(str(quotation_data.get('discount_rate', 0)))
    global_discount = Decimal('0.00')

    if disc_type == 'PERCENTAGE':
        if disc_rate > 0:
            global_discount = gross_subtotal * (disc_rate / Decimal('100.0'))
    else:
        global_discount = Decimal(str(quotation_data.get('discount_amount', disc_rate)))

    global_discount = min(gross_subtotal, round_currency(global_discount, decimals))
    subtotal_after_global_discount = gross_subtotal - global_discount

    # Cargos adicionales globales (envío, flete, propina/servicio)
    additional_charges = Decimal(str(quotation_data.get('additional_charges', 0)))
    additional_charges = round_currency(additional_charges, decimals)

    # Total general
    total = subtotal_after_global_discount + accum_taxes + additional_charges
    total = max(Decimal('0.00'), round_currency(total, decimals))

    return {
        'subtotal': round_currency(gross_subtotal, decimals),
        'discount_type': disc_type,
        'discount_rate': disc_rate,
        'discount_amount': round_currency(global_discount, decimals),
        'tax_amount': round_currency(accum_taxes, decimals),
        'additional_charges': additional_charges,
        'total': total,
        'processed_items': processed_items
    }


def create_quotation_revision(original_quotation, user):
    """
    Crea una nueva versión / revisión (v2, v3...) a partir de una cotización existente,
    conservando el historial y relacionándola con su cotización padre.
    """
    with transaction.atomic():
        new_version = original_quotation.version + 1
        new_consecutive = f"{original_quotation.consecutive.split('-v')[0]}-v{new_version}"
        
        new_quotation = Quotation.objects.create(
            consecutive=new_consecutive,
            version=new_version,
            parent_quotation=original_quotation,
            user=user if user and user.is_authenticated else original_quotation.user,
            customer=original_quotation.customer,
            warehouse=original_quotation.warehouse,
            customer_name=original_quotation.customer_name,
            customer_document=original_quotation.customer_document,
            customer_email=original_quotation.customer_email,
            customer_phone=original_quotation.customer_phone,
            customer_address=original_quotation.customer_address,
            status='DRAFT',
            issue_date=timezone.now().date(),
            validity_days=original_quotation.validity_days,
            valid_until=timezone.now().date() + timedelta(days=original_quotation.validity_days),
            subtotal=original_quotation.subtotal,
            discount_type=original_quotation.discount_type,
            discount_rate=original_quotation.discount_rate,
            discount_amount=original_quotation.discount_amount,
            tax_amount=original_quotation.tax_amount,
            additional_charges=original_quotation.additional_charges,
            additional_charges_notes=original_quotation.additional_charges_notes,
            total=original_quotation.total,
            currency_symbol=original_quotation.currency_symbol,
            currency_decimals=original_quotation.currency_decimals,
            custom_fields=original_quotation.custom_fields,
            notes=original_quotation.notes,
            terms_and_conditions=original_quotation.terms_and_conditions,
        )

        # Clonar items, adicionales y personalizaciones
        for item in original_quotation.items.all():
            new_item = QuotationItem.objects.create(
                quotation=new_quotation,
                product=item.product,
                is_manual=item.is_manual,
                name=item.name,
                sku=item.sku,
                description=item.description,
                measurement_unit=item.measurement_unit,
                quantity=item.quantity,
                unit_cost=item.product.price_buy if item.product else item.unit_cost,
                unit_price=item.unit_price,
                discount_type=item.discount_type,
                discount_rate=item.discount_rate,
                discount_amount=item.discount_amount,
                tax_percent=item.tax_percent,
                tax_amount=item.tax_amount,
                extras_amount=item.extras_amount,
                subtotal=item.subtotal,
                total=item.total,
                stock_at_quotation=get_available_stock(item.product, new_quotation.warehouse) if item.product else Decimal('0.00'),
                is_kit=item.is_kit,
                kit_components=item.kit_components,
                order_index=item.order_index,
            )
            for extra in item.extras.all():
                QuotationItemExtra.objects.create(
                    item=new_item,
                    product=extra.product,
                    name=extra.name,
                    price_type=extra.price_type,
                    rate=extra.rate,
                    quantity=extra.quantity,
                    total_price=extra.total_price,
                    deduct_stock=extra.deduct_stock
                )
            for cust in item.customizations.all():
                QuotationItemCustomization.objects.create(
                    item=new_item,
                    name=cust.name,
                    value=cust.value,
                    impact_type=cust.impact_type,
                    impact_value=cust.impact_value
                )

        log_quotation_event(
            new_quotation,
            user,
            'REVISION',
            f"Nueva revisión {new_consecutive} generada a partir de {original_quotation.consecutive}"
        )
        return new_quotation


def duplicate_quotation(original_quotation, user):
    """
    Duplica una cotización como un borrador independiente nuevo con nuevo consecutivo.
    """
    with transaction.atomic():
        new_consecutive = generate_next_consecutive()
        new_quotation = Quotation.objects.create(
            consecutive=new_consecutive,
            version=1,
            user=user if user and user.is_authenticated else original_quotation.user,
            customer=original_quotation.customer,
            warehouse=original_quotation.warehouse,
            customer_name=original_quotation.customer_name,
            customer_document=original_quotation.customer_document,
            customer_email=original_quotation.customer_email,
            customer_phone=original_quotation.customer_phone,
            customer_address=original_quotation.customer_address,
            status='DRAFT',
            issue_date=timezone.now().date(),
            validity_days=original_quotation.validity_days,
            valid_until=timezone.now().date() + timedelta(days=original_quotation.validity_days),
            subtotal=original_quotation.subtotal,
            discount_type=original_quotation.discount_type,
            discount_rate=original_quotation.discount_rate,
            discount_amount=original_quotation.discount_amount,
            tax_amount=original_quotation.tax_amount,
            additional_charges=original_quotation.additional_charges,
            additional_charges_notes=original_quotation.additional_charges_notes,
            total=original_quotation.total,
            currency_symbol=original_quotation.currency_symbol,
            currency_decimals=original_quotation.currency_decimals,
            custom_fields=original_quotation.custom_fields,
            notes=original_quotation.notes,
            terms_and_conditions=original_quotation.terms_and_conditions,
        )

        for item in original_quotation.items.all():
            new_item = QuotationItem.objects.create(
                quotation=new_quotation,
                product=item.product,
                is_manual=item.is_manual,
                name=item.name,
                sku=item.sku,
                description=item.description,
                measurement_unit=item.measurement_unit,
                quantity=item.quantity,
                unit_cost=item.product.price_buy if item.product else item.unit_cost,
                unit_price=item.unit_price,
                discount_type=item.discount_type,
                discount_rate=item.discount_rate,
                discount_amount=item.discount_amount,
                tax_percent=item.tax_percent,
                tax_amount=item.tax_amount,
                extras_amount=item.extras_amount,
                subtotal=item.subtotal,
                total=item.total,
                stock_at_quotation=get_available_stock(item.product, new_quotation.warehouse) if item.product else Decimal('0.00'),
                is_kit=item.is_kit,
                kit_components=item.kit_components,
                order_index=item.order_index,
            )
            for extra in item.extras.all():
                QuotationItemExtra.objects.create(
                    item=new_item,
                    product=extra.product,
                    name=extra.name,
                    price_type=extra.price_type,
                    rate=extra.rate,
                    quantity=extra.quantity,
                    total_price=extra.total_price,
                    deduct_stock=extra.deduct_stock
                )
            for cust in item.customizations.all():
                QuotationItemCustomization.objects.create(
                    item=new_item,
                    name=cust.name,
                    value=cust.value,
                    impact_type=cust.impact_type,
                    impact_value=cust.impact_value
                )

        log_quotation_event(
            new_quotation,
            user,
            'CREATE',
            f"Cotización duplicada a partir de {original_quotation.consecutive}"
        )
        return new_quotation


def reserve_stock_for_quotation(quotation, days=None, user=None):
    """
    Crea o renueva reservas de stock para los ítems de inventario de la cotización.
    """
    config = QuotationConfiguration.get_solo()
    if not config.enable_stock_reservation:
        return False, "La reserva de inventario está desactivada en la configuración."

    reservation_days = days or config.default_reservation_days
    expires_at = timezone.now() + timedelta(days=reservation_days)
    warehouse = quotation.warehouse or Warehouse.objects.first()

    with transaction.atomic():
        # Liberar reservas activas previas de esta cotización para recalcular
        quotation.stock_reservations.filter(status='ACTIVE').update(
            status='RELEASED',
            released_at=timezone.now()
        )

        reservations_created = []
        for item in quotation.items.all():
            if item.product and item.product.has_inventory_control:
                # Comprobar disponibilidad
                avail = get_available_stock(item.product, warehouse)
                if avail < item.quantity and not config.allow_zero_stock_quotation:
                    raise ValueError(f"Stock insuficiente para reservar {item.name}. Disponible: {avail}, Solicitado: {item.quantity}")

                res = StockReservation.objects.create(
                    quotation=quotation,
                    product=item.product,
                    warehouse=warehouse,
                    quantity=item.quantity,
                    status='ACTIVE',
                    expires_at=expires_at
                )
                reservations_created.append(res)

            # Reservar también adicionales que descuenten inventario
            for extra in item.extras.all():
                if extra.product and extra.deduct_stock and extra.product.has_inventory_control:
                    extra_total_qty = extra.quantity * item.quantity
                    res = StockReservation.objects.create(
                        quotation=quotation,
                        product=extra.product,
                        warehouse=warehouse,
                        quantity=extra_total_qty,
                        status='ACTIVE',
                        expires_at=expires_at
                    )
                    reservations_created.append(res)

        quotation.has_stock_reservation = True
        quotation.reservation_expires_at = expires_at
        quotation.save(update_fields=['has_stock_reservation', 'reservation_expires_at', 'updated_at'])

        log_quotation_event(
            quotation,
            user,
            'RESERVE_STOCK',
            f"Se reservó stock para {len(reservations_created)} ítems hasta {expires_at.strftime('%Y-%m-%d %H:%M')}"
        )
        return True, f"Stock reservado exitosamente por {reservation_days} días."


def release_stock_for_quotation(quotation, user=None):
    """Libera cualquier reserva activa de la cotización"""
    with transaction.atomic():
        count = quotation.stock_reservations.filter(status='ACTIVE').update(
            status='RELEASED',
            released_at=timezone.now()
        )
        quotation.has_stock_reservation = False
        quotation.reservation_expires_at = None
        quotation.save(update_fields=['has_stock_reservation', 'reservation_expires_at', 'updated_at'])

        if count > 0:
            log_quotation_event(
                quotation,
                user,
                'RELEASE_STOCK',
                f"Se liberaron las reservas de stock ({count} registros)."
            )
        return True
