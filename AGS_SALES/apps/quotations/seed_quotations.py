import os
import sys
import django
from decimal import Decimal
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.inventory.models import Product, Warehouse, Category
from apps.crm.models import Customer
from apps.quotations.models import (
    Quotation, QuotationItem, QuotationItemExtra, QuotationItemCustomization,
    QuotationConfiguration, ExtraTemplate
)
from apps.quotations.services import reserve_stock_for_quotation, generate_next_consecutive

User = get_user_model()

def run_seed():
    print("Iniciando carga de datos de ejemplo para Módulo de Cotizaciones...")

    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    warehouse = Warehouse.objects.first() or Warehouse.objects.create(name='Bodega Principal', location='Central')

    # Configuración general
    config = QuotationConfiguration.get_solo()
    config.consecutive_prefix = 'COT-'
    config.consecutive_include_year = True
    config.default_validity_days = 15
    config.enable_stock_reservation = True
    config.default_reservation_days = 3
    config.custom_fields_schema = [
        {'name': 'fecha_evento', 'label': 'Fecha del Evento / Servicio', 'type': 'date'},
        {'name': 'direccion_obra', 'label': 'Dirección de Entrega / Obra', 'type': 'text'},
        {'name': 'placa_vehiculo', 'label': 'Placa / Modelo Vehículo', 'type': 'text'},
    ]
    config.save()
    print("✓ Configuración de cotizaciones actualizada con campos dinámicos.")

    # 1. Clientes de prueba
    c1, _ = Customer.objects.get_or_create(
        document_number='900123456-1',
        defaults={
            'first_name': 'Constructora & Proyectos',
            'last_name': 'S.A.S.',
            'email': 'compras@constructoraproyectos.com',
            'phone': '3109876543',
            'address': 'Cra 43 # 72 - 105 Oficina 402'
        }
    )

    c2, _ = Customer.objects.get_or_create(
        document_number='1098765432',
        defaults={
            'first_name': 'Mariana',
            'last_name': 'Restrepo',
            'email': 'mariana.eventos@gmail.com',
            'phone': '3157778899',
            'address': 'Calle 85 # 15 - 20'
        }
    )

    # 2. Productos / Insumos
    p_tech, _ = Product.objects.get_or_create(
        internal_code='SRV-MONTAJE',
        defaults={
            'name': 'Kit Sistema POS Todo en Uno (Pantalla + Impresora + Gaveta)',
            'price_buy': Decimal('1500000.00'),
            'price_sell': Decimal('2400000.00'),
            'stock': Decimal('8.00'),
            'tax_percent': Decimal('19.00'),
            'has_inventory_control': True
        }
    )

    # 3. Cotización 1: Tecnología & Retail (Con adicionales de Garantía e Instalación)
    q1 = Quotation.objects.create(
        consecutive=generate_next_consecutive(),
        version=1,
        user=admin_user,
        customer=c1,
        warehouse=warehouse,
        customer_name='Constructora & Proyectos S.A.S.',
        customer_document='900123456-1',
        customer_email='compras@constructoraproyectos.com',
        customer_phone='3109876543',
        status='SENT',
        issue_date=timezone.now().date(),
        validity_days=15,
        valid_until=timezone.now().date() + timedelta(days=15),
        subtotal=Decimal('4800000.00'),
        discount_type='PERCENTAGE',
        discount_rate=Decimal('5.00'),
        discount_amount=Decimal('240000.00'),
        tax_amount=Decimal('866400.00'),
        additional_charges=Decimal('80000.00'),
        additional_charges_notes='Transporte y Seguro de Carga',
        total=Decimal('5506400.00'),
        custom_fields={'direccion_obra': 'Edificio Torre Norte, Piso 5'},
        notes='Incluye capacitación remota para 3 cajeros.'
    )

    item1 = QuotationItem.objects.create(
        quotation=q1,
        product=p_tech,
        name=p_tech.name,
        sku=p_tech.internal_code,
        quantity=Decimal('2.00'),
        unit_price=Decimal('2400000.00'),
        unit_cost=Decimal('1500000.00'),
        tax_percent=Decimal('19.00'),
        tax_amount=Decimal('866400.00'),
        subtotal=Decimal('4800000.00'),
        total=Decimal('5712000.00'),
        stock_at_quotation=Decimal('8.00')
    )

    QuotationItemExtra.objects.create(
        item=item1,
        name='Garantía Extendida 2 Años',
        price_type='PERCENTAGE',
        rate=Decimal('5.00'),
        quantity=Decimal('1.00'),
        total_price=Decimal('240000.00')
    )

    QuotationItemCustomization.objects.create(
        item=item1,
        name='Color de Carcasa',
        value='Negro Mate Antireflejo',
        impact_type='NONE'
    )

    # 4. Cotización 2: Servicios / Eventos / Catering (Con ítems libres manuales)
    q2 = Quotation.objects.create(
        consecutive=generate_next_consecutive(),
        version=1,
        user=admin_user,
        customer=c2,
        warehouse=warehouse,
        customer_name='Mariana Restrepo',
        customer_document='1098765432',
        customer_email='mariana.eventos@gmail.com',
        customer_phone='3157778899',
        status='APPROVED',
        issue_date=timezone.now().date(),
        validity_days=10,
        valid_until=timezone.now().date() + timedelta(days=10),
        subtotal=Decimal('3500000.00'),
        tax_amount=Decimal('0.00'),
        total=Decimal('3500000.00'),
        custom_fields={'fecha_evento': str(timezone.now().date() + timedelta(days=20))},
        notes='Servicio de banquete y montaje para 80 personas.'
    )

    QuotationItem.objects.create(
        quotation=q2,
        product=None,
        is_manual=True,
        name='Servicio Completo de Catering & Estación de Café',
        measurement_unit='Servicio',
        quantity=Decimal('1.00'),
        unit_price=Decimal('2500000.00'),
        subtotal=Decimal('2500000.00'),
        total=Decimal('2500000.00')
    )

    QuotationItem.objects.create(
        quotation=q2,
        product=None,
        is_manual=True,
        name='Mano de Obra: 4 Meseros y 1 Barista (8 Horas)',
        measurement_unit='Jornada',
        quantity=Decimal('1.00'),
        unit_price=Decimal('1000000.00'),
        subtotal=Decimal('1000000.00'),
        total=Decimal('1000000.00')
    )

    # Plantillas de adicionales reutilizables
    ExtraTemplate.objects.get_or_create(
        name='Garantía y Soporte Técnico VIP',
        defaults={
            'template_type': 'EXTRA',
            'config_data': {
                'options': [
                    {'name': 'Garantía 1 Año Extra', 'rate': 10, 'price_type': 'PERCENTAGE'},
                    {'name': 'Instalación en Sitio', 'rate': 150000, 'price_type': 'FIXED'}
                ]
            }
        }
    )

    print("✓ 2 Cotizaciones de ejemplo (Tecnología y Servicios) creadas con éxito.")
    print("✓ Plantillas de adicionales registradas.")

if __name__ == '__main__':
    run_seed()
