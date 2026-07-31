from rest_framework import serializers
from django.db import transaction
from .models import PaymentMethod, Sale, SaleDetail, Payment
from apps.inventory.models import Product

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = '__all__'

class SaleDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = SaleDetail
        fields = '__all__'
        read_only_fields = ('sale', 'subtotal')

class PaymentSerializer(serializers.ModelSerializer):
    payment_method_name = serializers.ReadOnlyField(source='payment_method.name')

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('sale',)

class SaleSerializer(serializers.ModelSerializer):
    details = SaleDetailSerializer(many=True)
    payments = PaymentSerializer(many=True, required=False)
    customer_name = serializers.SerializerMethodField()
    user_username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Sale
        fields = '__all__'
        read_only_fields = ('subtotal', 'tax', 'discount', 'total')

    def to_internal_value(self, data):
        # Prevent 400 validation error if the frontend sends a CashRegister ID instead of a valid Warehouse ID
        if 'warehouse' in data and data['warehouse'] is not None:
            from apps.inventory.models import Warehouse
            if not Warehouse.objects.filter(id=data['warehouse']).exists():
                first_wh = Warehouse.objects.first()
                data['warehouse'] = first_wh.id if first_wh else None
        return super().to_internal_value(data)

    def get_customer_name(self, obj):
        if obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}"
        return "Cliente Final"

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        payments_data = validated_data.pop('payments', [])
        
        # Auto-assign the logged-in user to the sale
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user
            
        with transaction.atomic():
            # Create Sale
            sale = Sale.objects.create(**validated_data)
            
            # Generate automated invoice number
            from apps.billing.models import DIANResolution
            resolution = DIANResolution.objects.filter(
                resolution_type=sale.invoice_type,
                is_active=True
            ).first()
            
            if resolution:
                if resolution.current_number == 0:
                    next_number = resolution.start_range
                else:
                    next_number = resolution.current_number + 1
                
                if next_number <= resolution.end_range:
                    resolution.current_number = next_number
                    resolution.save()
                    
                    prefix = resolution.prefix or ''
                    sale.invoice_number = f"{prefix}{next_number}"
                else:
                    sale.invoice_number = f"TEMP-{sale.invoice_type}-{sale.id}"
            else:
                sale.invoice_number = f"{sale.invoice_type}-{sale.id}"
            
            subtotal = 0
            tax = 0
            total_discount = 0
            
            # Create Details & Deduct Stock & Kardex
            for detail in details_data:
                product = detail['product']
                quantity = detail['quantity']
                unit_price = detail['unit_price']
                discount = detail.get('discount', 0)
                
                total_discount += discount
                # Calculate subtotal for this item
                item_subtotal = (quantity * unit_price) - discount
                item_tax = (item_subtotal * product.tax_percent) / 100
                
                subtotal += (quantity * unit_price)
                tax += item_tax
                
                SaleDetail.objects.create(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                    discount=discount,
                    subtotal=item_subtotal
                )
                
                # Check Stock Validation before deduction
                if product.has_inventory_control and product.stock < quantity:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para el producto: {product.name}. Disponible: {product.stock}, Solicitado: {quantity}"
                    )
                
                # Deduct from inventory (Product.stock)
                product.stock -= quantity
                product.save() # This triggers the Warehouse/Stock update via Product.save()

                # Record stock deduction in Kardex
                from apps.inventory.models import Kardex, Warehouse
                wh = sale.warehouse
                if not wh:
                    wh, _ = Warehouse.objects.get_or_create(
                        name='Bodega Principal', 
                        defaults={'location': 'Central'}
                    )
                
                Kardex.objects.create(
                    product=product,
                    warehouse=wh,
                    movement_type='OUT',
                    quantity=quantity,
                    reference=f"Venta {sale.invoice_number}"
                )

            sale.subtotal = subtotal
            sale.discount = total_discount
            sale.tax = tax
            sale.total = subtotal - total_discount + tax
            sale.save()
            
            # Create Payments & cash shift movements
            total_paid = 0
            
            if not payments_data:
                from .models import PaymentMethod
                cash_method, _ = PaymentMethod.objects.get_or_create(name='Efectivo')
                payments_data = [{'payment_method': cash_method, 'amount': sale.total}]
            
            for payment in payments_data:
                pm = payment.get('payment_method')
                amt = payment.get('amount', 0)
                Payment.objects.create(
                    sale=sale,
                    payment_method=pm,
                    amount=amt,
                    reference=payment.get('reference', '')
                )
                total_paid += amt
                
            # Create CashMovement record in the active shift of the user
            from apps.accounting.models import CashShift, CashMovement
            active_shift = CashShift.objects.filter(user=sale.user, is_open=True).first()
            if active_shift and total_paid > 0:
                CashMovement.objects.create(
                    shift=active_shift,
                    type='IN',
                    amount=total_paid,
                    description=f"Pago Recibido - Venta {sale.invoice_number}"
                )
                
            return sale

    def update(self, instance, validated_data):
        status = validated_data.get('status', instance.status)
        
        # If the sale is being cancelled, restore stock and create a cash movement refund
        if status == 'CANCELLED' and instance.status != 'CANCELLED':
            with transaction.atomic():
                # 1. Restore stock & Kardex
                from apps.inventory.models import Kardex, Warehouse
                wh = instance.warehouse
                if not wh:
                    wh = Warehouse.objects.first()
                
                for detail in instance.details.all():
                    product = detail.product
                    qty = detail.quantity
                    product.stock += qty
                    product.save()
                    
                    if wh:
                        Kardex.objects.create(
                            product=product,
                            warehouse=wh,
                            movement_type='IN',
                            quantity=qty,
                            reference=f"Venta Anulada {instance.invoice_number}"
                        )
                
                # 2. Record a CashMovement OUT for refund in active shift
                total_to_refund = sum(p.amount for p in instance.payments.all()) or instance.total
                from apps.accounting.models import CashShift, CashMovement
                request = self.context.get('request')
                current_user = request.user if (request and request.user.is_authenticated) else instance.user
                active_shift = CashShift.objects.filter(user=current_user, is_open=True).first()
                
                if active_shift and total_to_refund > 0:
                    CashMovement.objects.create(
                        shift=active_shift,
                        type='OUT',
                        amount=total_to_refund,
                        description=f"Reembolso por Venta Anulada {instance.invoice_number}"
                    )
                    
        return super().update(instance, validated_data)
