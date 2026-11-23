from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from apps.inventory.models import Product, Warehouse, Category, Kardex
from apps.crm.models import Customer
from apps.sales.models import Sale, SaleDetail, PaymentMethod
from apps.quotations.models import (
    Quotation, QuotationItem, QuotationItemExtra, QuotationItemCustomization,
    QuotationConfiguration, StockReservation
)
from apps.quotations.services import (
    calculate_quotation_totals, get_available_stock, reserve_stock_for_quotation,
    release_stock_for_quotation, generate_next_consecutive, duplicate_quotation,
    create_quotation_revision
)
from apps.quotations.conversion import convert_quotation_to_sale, validate_quotation_for_conversion

User = get_user_model()

class QuotationCalculationAndBusinessRulesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='vendedor1', password='pass123', role='USER')
        self.admin = User.objects.create_user(username='admin1', password='pass123', role='ADMIN')
        self.warehouse = Warehouse.objects.create(name='Bodega Central', location='Principal')
        self.category = Category.objects.create(name='Equipos')
        
        self.product_laptop = Product.objects.create(
            name='Laptop Dell XPS',
            internal_code='DELL-XPS-15',
            price_buy=Decimal('800.00'),
            price_sell=Decimal('1200.00'),
            stock=Decimal('10.00'),
            tax_percent=Decimal('19.00'),
            has_inventory_control=True
        )

        self.customer = Customer.objects.create(
            first_name='Carlos',
            last_name='Gomez',
            document_number='10203040',
            email='carlos@ejemplo.com',
            phone='3001234567'
        )

        self.config = QuotationConfiguration.get_solo()
        self.config.consecutive_prefix = 'COT-'
        self.config.consecutive_include_year = True
        self.config.default_validity_days = 15
        self.config.enable_stock_reservation = True
        self.config.default_reservation_days = 3
        self.config.save()

    def test_calculation_engine_with_extras_and_discounts(self):
        """Verifica que el cálculo de línea con adicionales (% y fijo), descuento y totales sea exacto"""
        items_data = [
            {
                'name': 'Laptop Dell XPS',
                'product_id': self.product_laptop.id,
                'quantity': 2,
                'unit_price': 1200.00,
                'discount_type': 'PERCENTAGE',
                'discount_rate': 10.0, # 10% descuento en línea
                'tax_percent': 19.0,
                'extras': [
                    {'name': 'Garantía Extendida', 'price_type': 'PERCENTAGE', 'rate': 5.0, 'quantity': 1}, # 5% de 2400 = 120
                    {'name': 'Mouse inalámbrico', 'price_type': 'FIXED', 'rate': 50.0, 'quantity': 2} # 100
                ],
                'customizations': [
                    {'name': 'Color', 'value': 'Gris Titanio', 'impact_type': 'ADD', 'impact_value': 20.0} # +20/u -> precio 1220
                ]
            }
        ]

        quotation_data = {
            'discount_type': 'FIXED',
            'discount_rate': 50.00, # $50 descuento global
            'additional_charges': 30.00 # Flete
        }

        result = calculate_quotation_totals(quotation_data, items_data, decimals=2)
        
        # Base: 2 x 1220 = 2440
        # Extras: 5% de 2440 = 122 + Mouse (50 x 2) = 100 -> Total extras = 222
        # Bruto línea: 2440 + 222 = 2662
        # Descuento línea 10%: 266.20 -> Subtotal línea: 2395.80
        # IVA línea (19% de 2395.80): 455.20
        # Descuento global: 50.00
        # Cargos adicionales: 30.00
        # Subtotal tras desc global: 2345.80 + IVA 455.20 + Flete 30.00 = 2831.00
        self.assertEqual(result['subtotal'], Decimal('2395.80'))
        self.assertEqual(result['discount_amount'], Decimal('50.00'))
        self.assertEqual(result['tax_amount'], Decimal('455.20'))
        self.assertEqual(result['additional_charges'], Decimal('30.00'))
        self.assertEqual(result['total'], Decimal('2831.00'))

    def test_consecutive_generation_unique(self):
        """Verifica que los consecutivos se generen secuencialmente y sin colisiones"""
        c1 = generate_next_consecutive()
        c2 = generate_next_consecutive()
        self.assertTrue(c1.startswith('COT-'))
        self.assertNotEqual(c1, c2)

    def test_stock_reservation_and_available_calculation(self):
        """Verifica que el stock disponible considere las reservas activas y las libere al vencer"""
        # Stock físico inicial = 10
        self.assertEqual(get_available_stock(self.product_laptop, self.warehouse), Decimal('10.00'))

        quotation = Quotation.objects.create(
            consecutive='COT-TEST-001',
            user=self.user,
            customer=self.customer,
            warehouse=self.warehouse,
            customer_name='Carlos Gomez',
            status='DRAFT',
            valid_until=timezone.now().date() + timedelta(days=15),
            total=Decimal('1200.00')
        )

        QuotationItem.objects.create(
            quotation=quotation,
            product=self.product_laptop,
            name=self.product_laptop.name,
            quantity=Decimal('4.00'),
            unit_price=Decimal('1200.00'),
            subtotal=Decimal('4800.00'),
            total=Decimal('4800.00')
        )

        # Reservar stock por 3 días
        success, msg = reserve_stock_for_quotation(quotation, days=3, user=self.user)
        self.assertTrue(success)
        self.assertTrue(quotation.has_stock_reservation)

        # Ahora el stock disponible debe ser 10 - 4 = 6
        self.assertEqual(get_available_stock(self.product_laptop, self.warehouse), Decimal('6.00'))

        # Liberar stock
        release_stock_for_quotation(quotation, user=self.user)
        self.assertFalse(quotation.has_stock_reservation)
        self.assertEqual(get_available_stock(self.product_laptop, self.warehouse), Decimal('10.00'))

    def test_duplicate_and_revision_versioning(self):
        """Verifica que se puedan crear revisiones (v2) y duplicados conservando historial"""
        q1 = Quotation.objects.create(
            consecutive='COT-2026-0010',
            version=1,
            user=self.user,
            customer=self.customer,
            customer_name='Carlos Gomez',
            status='DRAFT',
            valid_until=timezone.now().date() + timedelta(days=15),
            total=Decimal('1200.00')
        )
        QuotationItem.objects.create(
            quotation=q1,
            product=self.product_laptop,
            name=self.product_laptop.name,
            quantity=Decimal('1.00'),
            unit_price=Decimal('1200.00'),
            subtotal=Decimal('1200.00'),
            total=Decimal('1200.00')
        )

        # Crear revisión v2
        rev = create_quotation_revision(q1, self.user)
        self.assertEqual(rev.version, 2)
        self.assertEqual(rev.parent_quotation, q1)
        self.assertTrue(rev.consecutive.endswith('-v2'))
        self.assertEqual(rev.items.count(), 1)

        # Duplicar
        dup = duplicate_quotation(q1, self.user)
        self.assertEqual(dup.version, 1)
        self.assertNotEqual(dup.consecutive, q1.consecutive)
        self.assertEqual(dup.items.count(), 1)

    def test_convert_quotation_to_sale_flow(self):
        """
        Verifica el ciclo completo de conversión a venta POS:
        - Creación de Venta (Sale) y SaleDetail.
        - Descuento de stock en Product y registro en Kardex.
        - Transición de estado a CONVERTED.
        - Consumo de reservas.
        """
        PaymentMethod.objects.get_or_create(name='Efectivo')

        quotation = Quotation.objects.create(
            consecutive='COT-VTA-001',
            user=self.user,
            customer=self.customer,
            warehouse=self.warehouse,
            customer_name='Carlos Gomez',
            status='APPROVED',
            issue_date=timezone.now().date(),
            valid_until=timezone.now().date() + timedelta(days=15),
            subtotal=Decimal('2400.00'),
            tax_amount=Decimal('456.00'),
            total=Decimal('2856.00')
        )

        QuotationItem.objects.create(
            quotation=quotation,
            product=self.product_laptop,
            name=self.product_laptop.name,
            quantity=Decimal('2.00'),
            unit_price=Decimal('1200.00'),
            subtotal=Decimal('2400.00'),
            total=Decimal('2856.00')
        )

        # Reservar stock primero
        reserve_stock_for_quotation(quotation, days=3, user=self.user)
        self.assertEqual(quotation.stock_reservations.filter(status='ACTIVE').count(), 1)

        # Stock físico antes de venta = 10
        self.assertEqual(self.product_laptop.stock, Decimal('10.00'))

        # Convertir a venta
        sale = convert_quotation_to_sale(quotation, user=self.user)

        self.assertIsNotNone(sale)
        self.assertIsNotNone(sale.invoice_number)
        self.assertEqual(sale.status, 'COMPLETED')

        # Recargar producto: stock físico debe ser 10 - 2 = 8
        self.product_laptop.refresh_from_db()
        self.assertEqual(self.product_laptop.stock, Decimal('8.00'))

        # Verificar movimiento Kardex tipo OUT
        kardex = Kardex.objects.filter(product=self.product_laptop, movement_type='OUT').first()
        self.assertIsNotNone(kardex)
        self.assertEqual(kardex.quantity, Decimal('2.00'))

        # Cotización debe estar en estado CONVERTED
        quotation.refresh_from_db()
        self.assertEqual(quotation.status, 'CONVERTED')
        self.assertEqual(quotation.sale, sale)

        # Reservas deben estar en CONSUMED
        self.assertEqual(quotation.stock_reservations.filter(status='CONSUMED').count(), 1)
        self.assertEqual(quotation.stock_reservations.filter(status='ACTIVE').count(), 0)
