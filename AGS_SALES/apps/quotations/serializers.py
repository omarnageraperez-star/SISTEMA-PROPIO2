from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from apps.inventory.models import Product, Warehouse
from apps.crm.models import Customer
from .models import (
    QuotationConfiguration, Quotation, QuotationItem, QuotationItemExtra,
    QuotationItemCustomization, ExtraTemplate, StockReservation, QuotationAuditLog
)
from .services import (
    generate_next_consecutive, get_currency_config, calculate_quotation_totals,
    get_available_stock, log_quotation_event
)


class QuotationConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationConfiguration
        fields = '__all__'


class ExtraTemplateSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = ExtraTemplate
        fields = '__all__'


class QuotationItemExtraSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = QuotationItemExtra
        fields = '__all__'
        read_only_fields = ('item', 'total_price')


class QuotationItemCustomizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItemCustomization
        fields = '__all__'
        read_only_fields = ('item',)


class QuotationItemSerializer(serializers.ModelSerializer):
    extras = QuotationItemExtraSerializer(many=True, required=False)
    customizations = QuotationItemCustomizationSerializer(many=True, required=False)
    product_name = serializers.ReadOnlyField(source='product.name')
    current_product_stock = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()
    estimated_margin = serializers.SerializerMethodField()

    class Meta:
        model = QuotationItem
        fields = '__all__'
        read_only_fields = ('quotation', 'subtotal', 'total', 'extras_amount', 'tax_amount')

    def get_current_product_stock(self, obj):
        if obj.product:
            return float(obj.product.stock)
        return None

    def get_available_stock(self, obj):
        if obj.product:
            warehouse = obj.quotation.warehouse if hasattr(obj, 'quotation') and obj.quotation else None
            return float(get_available_stock(obj.product, warehouse))
        return None

    def get_estimated_margin(self, obj):
        request = self.context.get('request')
        can_view_costs = False
        if request and request.user and request.user.is_authenticated:
            user = request.user
            custom_perms = user.custom_permissions or {}
            can_view_costs = (
                user.role in ('SUPERADMIN', 'ADMIN') or
                user.is_superuser or
                custom_perms.get('quotations.view_margins') or
                custom_perms.get('inventory.view_costs')
            )
        if not can_view_costs:
            return None
        
        cost = obj.unit_cost or Decimal('0.00')
        price = obj.unit_price or Decimal('0.00')
        if price > 0:
            margin = ((price - cost) / price) * Decimal('100.0')
            return round(float(margin), 1)
        return 0.0

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        can_view_costs = False
        if request and request.user and request.user.is_authenticated:
            user = request.user
            custom_perms = user.custom_permissions or {}
            can_view_costs = (
                user.role in ('SUPERADMIN', 'ADMIN') or
                user.is_superuser or
                custom_perms.get('quotations.view_margins') or
                custom_perms.get('inventory.view_costs')
            )
        if not can_view_costs:
            ret['unit_cost'] = None
        return ret


class StockReservationSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = StockReservation
        fields = '__all__'


class QuotationAuditLogSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = QuotationAuditLog
        fields = '__all__'


class QuotationListSerializer(serializers.ModelSerializer):
    """Serializador liviano para listados rápidos con filtros y KPIs"""
    user_name = serializers.SerializerMethodField()
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = (
            'id', 'consecutive', 'version', 'status', 'customer_name', 'customer_document',
            'customer_phone', 'customer_email', 'user_name', 'issue_date', 'valid_until',
            'validity_days', 'subtotal', 'discount_amount', 'tax_amount', 'additional_charges',
            'total', 'currency_symbol', 'has_stock_reservation', 'items_count', 'is_expired',
            'created_at', 'parent_quotation', 'sale'
        )

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return "Sistema"

    def get_is_expired(self, obj):
        if obj.status in ('DRAFT', 'SENT') and obj.valid_until:
            return obj.valid_until < timezone.now().date()
        return False


class QuotationDetailSerializer(serializers.ModelSerializer):
    """Serializador detallado con líneas, extras, auditoría y relaciones completas"""
    items = QuotationItemSerializer(many=True, read_only=True)
    audit_logs = QuotationAuditLogSerializer(many=True, read_only=True)
    stock_reservations = StockReservationSerializer(many=True, read_only=True)
    user_name = serializers.SerializerMethodField()
    customer_info = serializers.SerializerMethodField()
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    sale_invoice_number = serializers.ReadOnlyField(source='sale.invoice_number')

    class Meta:
        model = Quotation
        fields = '__all__'

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return "Sistema"

    def get_customer_info(self, obj):
        if obj.customer:
            return {
                'id': obj.customer.id,
                'name': f"{obj.customer.first_name} {obj.customer.last_name}".strip(),
                'document_type': obj.customer.document_type,
                'document_number': obj.customer.document_number,
                'email': obj.customer.email,
                'phone': obj.customer.phone,
                'address': obj.customer.address,
            }
        return None


class QuotationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador de escritura para crear o actualizar cotizaciones de manera atómica,
    recalculando precios, subtotales e impuestos en el backend.
    """
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=True)
    customer_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Quotation
        fields = (
            'id', 'customer_id', 'warehouse', 'customer_name', 'customer_document',
            'customer_email', 'customer_phone', 'customer_address', 'status',
            'issue_date', 'validity_days', 'discount_type', 'discount_rate',
            'discount_amount', 'additional_charges', 'additional_charges_notes',
            'custom_fields', 'notes', 'terms_and_conditions', 'items'
        )

    def validate(self, attrs):
        items_data = attrs.get('items', [])
        if not items_data:
            raise serializers.ValidationError({"items": "Debe incluir al menos un ítem en la cotización."})

        # Validar control de descuento máximo si el usuario no es administrador
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            user = request.user
            if user.role not in ('SUPERADMIN', 'ADMIN') and not user.is_superuser:
                config = QuotationConfiguration.get_solo()
                disc_rate = Decimal(str(attrs.get('discount_rate', 0)))
                disc_type = attrs.get('discount_type', 'PERCENTAGE')
                if disc_type == 'PERCENTAGE' and disc_rate > config.max_discount_cashier:
                    raise serializers.ValidationError({
                        "discount_rate": f"El descuento máximo permitido para tu rol es del {config.max_discount_cashier}%. Descuentos mayores requieren aprobación de un administrador."
                    })

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer_id = validated_data.pop('customer_id', None)

        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        with transaction.atomic():
            config = QuotationConfiguration.get_solo()
            currency_symbol, currency_decimals = get_currency_config()

            # Resolver cliente si vino customer_id
            customer = None
            if customer_id:
                customer = Customer.objects.filter(id=customer_id).first()
                if customer:
                    validated_data['customer'] = customer
                    if not validated_data.get('customer_name'):
                        validated_data['customer_name'] = f"{customer.first_name} {customer.last_name}".strip()
                    if not validated_data.get('customer_document'):
                        validated_data['customer_document'] = customer.document_number
                    if not validated_data.get('customer_email'):
                        validated_data['customer_email'] = customer.email
                    if not validated_data.get('customer_phone'):
                        validated_data['customer_phone'] = customer.phone
                    if not validated_data.get('customer_address'):
                        validated_data['customer_address'] = customer.address

            # Asignar consecutivo y valores por defecto
            consecutive = generate_next_consecutive()
            validity_days = validated_data.get('validity_days') or config.default_validity_days
            issue_date = validated_data.get('issue_date') or timezone.now().date()
            valid_until = issue_date + timedelta(days=validity_days)

            # Resolver bodega por defecto
            if not validated_data.get('warehouse'):
                default_wh = Warehouse.objects.first()
                validated_data['warehouse'] = default_wh

            # Calcular totales del backend
            calc_result = calculate_quotation_totals(validated_data, items_data, currency_decimals)

            quotation = Quotation.objects.create(
                consecutive=consecutive,
                version=1,
                user=user,
                customer=validated_data.get('customer'),
                warehouse=validated_data.get('warehouse'),
                customer_name=validated_data.get('customer_name') or 'Cliente General',
                customer_document=validated_data.get('customer_document', ''),
                customer_email=validated_data.get('customer_email', ''),
                customer_phone=validated_data.get('customer_phone', ''),
                customer_address=validated_data.get('customer_address', ''),
                status=validated_data.get('status', 'DRAFT'),
                issue_date=issue_date,
                validity_days=validity_days,
                valid_until=valid_until,
                subtotal=calc_result['subtotal'],
                discount_type=calc_result['discount_type'],
                discount_rate=calc_result['discount_rate'],
                discount_amount=calc_result['discount_amount'],
                tax_amount=calc_result['tax_amount'],
                additional_charges=calc_result['additional_charges'],
                additional_charges_notes=validated_data.get('additional_charges_notes', ''),
                total=calc_result['total'],
                currency_symbol=currency_symbol,
                currency_decimals=currency_decimals,
                custom_fields=validated_data.get('custom_fields', {}),
                notes=validated_data.get('notes', config.default_notes),
                terms_and_conditions=validated_data.get('terms_and_conditions', config.default_terms),
            )

            # Crear líneas procesadas
            for proc in calc_result['processed_items']:
                raw_item = proc['item_data']
                calc = proc['calc']
                
                product = None
                product_id = raw_item.get('product') or raw_item.get('product_id')
                if product_id:
                    product = Product.objects.filter(id=product_id).first()

                is_manual = raw_item.get('is_manual', False) or (product is None)
                item_name = raw_item.get('name') or (product.name if product else 'Ítem libre')
                unit_cost = product.price_buy if product else Decimal(str(raw_item.get('unit_cost', 0)))

                avail_stock = get_available_stock(product, quotation.warehouse) if product else Decimal('0.00')

                q_item = QuotationItem.objects.create(
                    quotation=quotation,
                    product=product,
                    is_manual=is_manual,
                    name=item_name,
                    sku=raw_item.get('sku') or (product.sku or product.internal_code if product else ''),
                    description=raw_item.get('description', ''),
                    measurement_unit=raw_item.get('measurement_unit') or (product.measurement_unit if product else 'Unidad'),
                    quantity=calc['quantity'],
                    unit_cost=unit_cost,
                    unit_price=calc['unit_price'],
                    discount_type=calc['discount_type'],
                    discount_rate=calc['discount_rate'],
                    discount_amount=calc['discount_amount'],
                    tax_percent=calc['tax_percent'],
                    tax_amount=calc['tax_amount'],
                    extras_amount=calc['extras_amount'],
                    subtotal=calc['subtotal'],
                    total=calc['total'],
                    stock_at_quotation=avail_stock,
                    is_kit=raw_item.get('is_kit', False),
                    kit_components=raw_item.get('kit_components', []),
                    order_index=proc['order_index'],
                )

                # Guardar adicionales calculados
                for ex in calc.get('calculated_extras', []):
                    ex_product = None
                    if ex.get('product') or ex.get('product_id'):
                        ex_product = Product.objects.filter(id=ex.get('product') or ex.get('product_id')).first()
                    QuotationItemExtra.objects.create(
                        item=q_item,
                        product=ex_product,
                        name=ex.get('name', 'Adicional'),
                        price_type=ex.get('price_type', 'FIXED'),
                        rate=ex.get('rate', 0),
                        quantity=ex.get('quantity', 1),
                        total_price=ex.get('total_price', 0),
                        deduct_stock=ex.get('deduct_stock', False),
                    )

                # Guardar personalizaciones
                for cust in raw_item.get('customizations', []):
                    QuotationItemCustomization.objects.create(
                        item=q_item,
                        name=cust.get('name', ''),
                        value=cust.get('value', ''),
                        impact_type=cust.get('impact_type', 'NONE'),
                        impact_value=Decimal(str(cust.get('impact_value', 0))),
                    )

            log_quotation_event(
                quotation,
                user,
                'CREATE',
                f"Cotización {quotation.consecutive} creada por valor de {quotation.currency_symbol}{quotation.total} ({len(items_data)} ítems)."
            )

            return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        customer_id = validated_data.pop('customer_id', None)
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        if instance.status in ('CONVERTED', 'CANCELLED'):
            raise serializers.ValidationError({"detail": f"No se puede modificar una cotización en estado {instance.get_status_display()}."})

        with transaction.atomic():
            currency_symbol, currency_decimals = get_currency_config()
            config = QuotationConfiguration.get_solo()

            if customer_id is not None:
                if customer_id:
                    instance.customer = Customer.objects.filter(id=customer_id).first()
                else:
                    instance.customer = None

            for attr, val in validated_data.items():
                setattr(instance, attr, val)

            if 'validity_days' in validated_data or 'issue_date' in validated_data:
                v_days = validated_data.get('validity_days', instance.validity_days)
                i_date = validated_data.get('issue_date', instance.issue_date)
                instance.valid_until = i_date + timedelta(days=v_days)

            # Recalcular si vinieron ítems
            if items_data is not None:
                calc_result = calculate_quotation_totals(
                    {
                        'discount_type': instance.discount_type,
                        'discount_rate': instance.discount_rate,
                        'discount_amount': instance.discount_amount,
                        'additional_charges': instance.additional_charges,
                    },
                    items_data,
                    currency_decimals
                )

                instance.subtotal = calc_result['subtotal']
                instance.discount_amount = calc_result['discount_amount']
                instance.tax_amount = calc_result['tax_amount']
                instance.total = calc_result['total']

                # Reemplazar ítems
                instance.items.all().delete()
                for proc in calc_result['processed_items']:
                    raw_item = proc['item_data']
                    calc = proc['calc']
                    product = None
                    product_id = raw_item.get('product') or raw_item.get('product_id')
                    if product_id:
                        product = Product.objects.filter(id=product_id).first()

                    is_manual = raw_item.get('is_manual', False) or (product is None)
                    item_name = raw_item.get('name') or (product.name if product else 'Ítem libre')
                    unit_cost = product.price_buy if product else Decimal(str(raw_item.get('unit_cost', 0)))
                    avail_stock = get_available_stock(product, instance.warehouse) if product else Decimal('0.00')

                    q_item = QuotationItem.objects.create(
                        quotation=instance,
                        product=product,
                        is_manual=is_manual,
                        name=item_name,
                        sku=raw_item.get('sku') or (product.sku or product.internal_code if product else ''),
                        description=raw_item.get('description', ''),
                        measurement_unit=raw_item.get('measurement_unit') or (product.measurement_unit if product else 'Unidad'),
                        quantity=calc['quantity'],
                        unit_cost=unit_cost,
                        unit_price=calc['unit_price'],
                        discount_type=calc['discount_type'],
                        discount_rate=calc['discount_rate'],
                        discount_amount=calc['discount_amount'],
                        tax_percent=calc['tax_percent'],
                        tax_amount=calc['tax_amount'],
                        extras_amount=calc['extras_amount'],
                        subtotal=calc['subtotal'],
                        total=calc['total'],
                        stock_at_quotation=avail_stock,
                        is_kit=raw_item.get('is_kit', False),
                        kit_components=raw_item.get('kit_components', []),
                        order_index=proc['order_index'],
                    )

                    for ex in calc.get('calculated_extras', []):
                        ex_prod = None
                        if ex.get('product') or ex.get('product_id'):
                            ex_prod = Product.objects.filter(id=ex.get('product') or ex.get('product_id')).first()
                        QuotationItemExtra.objects.create(
                            item=q_item,
                            product=ex_prod,
                            name=ex.get('name', 'Adicional'),
                            price_type=ex.get('price_type', 'FIXED'),
                            rate=ex.get('rate', 0),
                            quantity=ex.get('quantity', 1),
                            total_price=ex.get('total_price', 0),
                            deduct_stock=ex.get('deduct_stock', False),
                        )

                    for cust in raw_item.get('customizations', []):
                        QuotationItemCustomization.objects.create(
                            item=q_item,
                            name=cust.get('name', ''),
                            value=cust.get('value', ''),
                            impact_type=cust.get('impact_type', 'NONE'),
                            impact_value=Decimal(str(cust.get('impact_value', 0))),
                        )

            instance.save()
            log_quotation_event(
                instance,
                user,
                'EDIT',
                f"Cotización {instance.consecutive} actualizada."
            )
            return instance
