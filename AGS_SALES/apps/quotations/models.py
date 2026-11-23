from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal

User = get_user_model()

class QuotationConfiguration(models.Model):
    """
    Configuración global del módulo de cotizaciones. Singleton.
    """
    consecutive_prefix = models.CharField("Prefijo de Consecutivo", max_length=10, default="COT-")
    consecutive_include_year = models.BooleanField("Incluir Año en Consecutivo (ej. COT-2026-0001)", default=True)
    next_number = models.PositiveIntegerField("Siguiente Número", default=1)
    default_validity_days = models.PositiveIntegerField("Días de Vigencia por Defecto", default=15)
    default_terms = models.TextField(
        "Términos y Condiciones por Defecto",
        blank=True,
        default="Precios sujetos a cambio sin previo aviso. Esta cotización es válida durante el período indicado. Los tiempos de entrega están sujetos a disponibilidad de inventario."
    )
    default_notes = models.TextField(
        "Notas por Defecto",
        blank=True,
        default="Gracias por su confianza. Para aceptar esta cotización, por favor comuníquese con nosotros."
    )
    enable_stock_reservation = models.BooleanField("Permitir Reserva de Stock", default=True)
    default_reservation_days = models.PositiveIntegerField("Días de Reserva por Defecto", default=3)
    allow_manual_items = models.BooleanField("Permitir Ítems Libres/Manuales", default=True)
    allow_zero_stock_quotation = models.BooleanField("Permitir Cotizar Productos sin Stock Físico", default=True)
    max_discount_cashier = models.DecimalField("Descuento Máximo Vendedor/Cajero (%)", max_digits=5, decimal_places=2, default=Decimal('10.00'))
    custom_fields_schema = models.JSONField(
        "Esquema de Campos Personalizados",
        default=list,
        blank=True,
        help_text="Lista de campos dinámicos activables (ej. Fecha de evento, Placa, Dirección de obra)"
    )
    pdf_primary_color = models.CharField("Color Primario PDF", max_length=20, default="#2563eb")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Cotizaciones"
        verbose_name_plural = "Configuraciones de Cotizaciones"

    def __str__(self):
        return f"Configuración Cotizaciones (Prefijo: {self.consecutive_prefix})"

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(id=1)
        return config


class Quotation(models.Model):
    """
    Modelo maestro de Cotización.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Borrador'),
        ('SENT', 'Enviada'),
        ('APPROVED', 'Aprobada'),
        ('REJECTED', 'Rechazada'),
        ('EXPIRED', 'Vencida'),
        ('CONVERTED', 'Convertida en Venta'),
        ('CANCELLED', 'Cancelada'),
    ]

    DISCOUNT_TYPE_CHOICES = [
        ('PERCENTAGE', 'Porcentaje (%)'),
        ('FIXED', 'Monto Fijo ($)'),
    ]

    consecutive = models.CharField("Consecutivo", max_length=50, unique=True, db_index=True)
    version = models.PositiveIntegerField("Revisión/Versión", default=1)
    parent_quotation = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revisions',
        verbose_name="Cotización Origen (para revisiones)"
    )

    # Relaciones principales
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations',
        verbose_name="Vendedor / Creador"
    )
    customer = models.ForeignKey(
        'crm.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotations',
        verbose_name="Cliente Vinculado"
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Bodega"
    )
    sale = models.ForeignKey(
        'sales.Sale',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_quotations',
        verbose_name="Venta Generada"
    )

    # Snapshot del Cliente (permite cotizar sin cliente previo o preservar datos históricos)
    customer_name = models.CharField("Nombre Cliente", max_length=200)
    customer_document = models.CharField("Documento Cliente", max_length=50, blank=True, null=True)
    customer_email = models.EmailField("Email Cliente", max_length=191, blank=True, null=True)
    customer_phone = models.CharField("Teléfono Cliente", max_length=30, blank=True, null=True)
    customer_address = models.TextField("Dirección Cliente", blank=True, null=True)

    # Ciclo de vida
    status = models.CharField("Estado", max_length=20, choices=STATUS_CHOICES, default='DRAFT', db_index=True)
    issue_date = models.DateField("Fecha de Emisión", default=timezone.now)
    validity_days = models.PositiveIntegerField("Días de Vigencia", default=15)
    valid_until = models.DateField("Válido Hasta")

    # Cálculos y totales
    subtotal = models.DecimalField("Subtotal Bruto", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_type = models.CharField("Tipo Descuento Global", max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='PERCENTAGE')
    discount_rate = models.DecimalField("Tasa Descuento Global", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField("Monto Descuento Global", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField("Impuestos Totales", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Cargos globales (envío, flete, instalación, propina/servicio)
    additional_charges = models.DecimalField("Cargos Globales Adicionales", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    additional_charges_notes = models.CharField("Concepto Cargos Adicionales", max_length=255, blank=True, null=True)
    
    total = models.DecimalField("Total General", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    currency_symbol = models.CharField("Símbolo Moneda", max_length=10, default='$')
    currency_decimals = models.PositiveIntegerField("Decimales", default=2)

    # Adaptabilidad: campos personalizados dinámicos (ej: fecha_evento, obra, placa)
    custom_fields = models.JSONField("Campos Personalizados", default=dict, blank=True)

    # Notas, términos y observaciones
    notes = models.TextField("Notas Internas / Observaciones", blank=True, null=True)
    terms_and_conditions = models.TextField("Términos y Condiciones", blank=True, null=True)
    rejection_reason = models.TextField("Motivo de Rechazo", blank=True, null=True)

    # Reserva de stock
    has_stock_reservation = models.BooleanField("Tiene Reserva de Stock", default=False)
    reservation_expires_at = models.DateTimeField("Expiración de Reserva", null=True, blank=True)

    # Trazabilidad
    created_at = models.DateTimeField("Creado", auto_now_add=True)
    updated_at = models.DateTimeField("Modificado", auto_now=True)
    approved_at = models.DateTimeField("Aprobado el", null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_quotations')
    converted_at = models.DateTimeField("Convertido el", null=True, blank=True)

    class Meta:
        verbose_name = "Cotización"
        verbose_name_plural = "Cotizaciones"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['consecutive']),
            models.Index(fields=['customer']),
            models.Index(fields=['issue_date']),
            models.Index(fields=['valid_until']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.consecutive} (v{self.version}) - {self.customer_name} - {self.get_status_display()}"

    def check_and_update_expiration(self):
        """Verifica automáticamente si la cotización venció según la fecha actual"""
        today = timezone.now().date()
        if self.status in ('DRAFT', 'SENT') and self.valid_until and self.valid_until < today:
            self.status = 'EXPIRED'
            self.save(update_fields=['status', 'updated_at'])
            return True
        return False


class QuotationItem(models.Model):
    """
    Línea de cotización: producto de inventario o ítem manual/libre.
    """
    DISCOUNT_TYPE_CHOICES = [
        ('PERCENTAGE', 'Porcentaje (%)'),
        ('FIXED', 'Monto Fijo ($)'),
    ]

    quotation = models.ForeignKey(Quotation, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotation_items',
        verbose_name="Producto de Inventario"
    )
    is_manual = models.BooleanField("Es Ítem Manual/Servicio", default=False)
    name = models.CharField("Descripción / Nombre del Ítem", max_length=255)
    sku = models.CharField("SKU / Código", max_length=100, blank=True, null=True)
    description = models.TextField("Detalle Adicional", blank=True, null=True)
    measurement_unit = models.CharField("Unidad de Medida", max_length=50, default='Unidad')
    
    quantity = models.DecimalField("Cantidad", max_digits=12, decimal_places=2, default=Decimal('1.00'))
    unit_cost = models.DecimalField("Costo Unitario (Snapshot)", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    unit_price = models.DecimalField("Precio Unitario Cotizado", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Descuento por línea
    discount_type = models.CharField("Tipo Descuento", max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='PERCENTAGE')
    discount_rate = models.DecimalField("Tasa Descuento", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField("Monto Descuento", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    tax_percent = models.DecimalField("Impuesto %", max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField("Monto Impuesto", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    extras_amount = models.DecimalField("Total Adicionales/Extras", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField("Subtotal Línea", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField("Total Línea", max_digits=12, decimal_places=2, default=Decimal('0.00'))

    stock_at_quotation = models.DecimalField("Stock Físico al Cotizar", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Soporte para combos / kits / BOM simple
    is_kit = models.BooleanField("Es Combo / Kit", default=False)
    kit_components = models.JSONField("Componentes del Kit (BOM)", default=list, blank=True)
    
    order_index = models.PositiveIntegerField("Orden", default=0)

    class Meta:
        verbose_name = "Línea de Cotización"
        verbose_name_plural = "Líneas de Cotización"
        ordering = ['order_index', 'id']

    def __str__(self):
        return f"{self.quantity} x {self.name} ({self.total})"


class QuotationItemExtra(models.Model):
    """
    Adicional / Extra vinculado a una línea (ej: instalación, garantía extendida, insumo extra).
    """
    PRICE_TYPE_CHOICES = [
        ('FIXED', 'Monto Fijo Total ($)'),
        ('PER_UNIT', 'Por Unidad de Ítem ($/u)'),
        ('PERCENTAGE', 'Porcentaje del Ítem (%)'),
    ]

    item = models.ForeignKey(QuotationItem, related_name='extras', on_delete=models.CASCADE)
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='as_quotation_extra',
        verbose_name="Producto de Inventario (si descuenta insumo)"
    )
    name = models.CharField("Nombre del Adicional", max_length=150)
    price_type = models.CharField("Tipo de Precio", max_length=20, choices=PRICE_TYPE_CHOICES, default='FIXED')
    rate = models.DecimalField("Tarifa / Valor", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    quantity = models.DecimalField("Cantidad de Adicional", max_digits=12, decimal_places=2, default=Decimal('1.00'))
    total_price = models.DecimalField("Precio Total del Adicional", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    deduct_stock = models.BooleanField("Descontar Stock al Vender", default=False)

    class Meta:
        verbose_name = "Adicional de Línea"
        verbose_name_plural = "Adicionales de Línea"

    def __str__(self):
        return f"+ {self.name}: {self.total_price}"


class QuotationItemCustomization(models.Model):
    """
    Personalización de una línea (ej: Talla, Color, Medidas, Grabado, Material).
    Puede impactar o no el precio.
    """
    IMPACT_TYPE_CHOICES = [
        ('NONE', 'Sin impacto en precio'),
        ('ADD', 'Suma al precio ($)'),
        ('SUBTRACT', 'Resta al precio ($)'),
        ('MULTIPLY', 'Multiplicador factor'),
    ]

    item = models.ForeignKey(QuotationItem, related_name='customizations', on_delete=models.CASCADE)
    name = models.CharField("Nombre de Opción", max_length=100) # ej: Color, Talla, Grabado
    value = models.CharField("Valor Seleccionado / Texto", max_length=255) # ej: Azul, Personalizado "Juan"
    impact_type = models.CharField("Impacto en Precio", max_length=20, choices=IMPACT_TYPE_CHOICES, default='NONE')
    impact_value = models.DecimalField("Valor de Impacto", max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = "Personalización de Línea"
        verbose_name_plural = "Personalizaciones de Línea"

    def __str__(self):
        return f"{self.name}: {self.value}"


class ExtraTemplate(models.Model):
    """
    Plantillas de adicionales y opciones reutilizables por producto o categoría.
    """
    TEMPLATE_TYPE_CHOICES = [
        ('EXTRA', 'Adicional / Extra'),
        ('CUSTOMIZATION', 'Personalización / Atributo'),
    ]

    name = models.CharField("Nombre de Plantilla", max_length=150)
    template_type = models.CharField("Tipo", max_length=20, choices=TEMPLATE_TYPE_CHOICES, default='EXTRA')
    category = models.ForeignKey('inventory.Category', on_delete=models.SET_NULL, null=True, blank=True, related_name='extra_templates')
    product = models.ForeignKey('inventory.Product', on_delete=models.SET_NULL, null=True, blank=True, related_name='extra_templates')
    config_data = models.JSONField("Configuración de Opciones y Precios", default=dict)
    is_active = models.BooleanField("Activa", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Plantilla de Adicionales"
        verbose_name_plural = "Plantillas de Adicionales"

    def __str__(self):
        return f"Plantilla [{self.get_template_type_display()}]: {self.name}"


class StockReservation(models.Model):
    """
    Control de reserva de inventario para cotizaciones aprobadas/activas.
    Stock disponible = Stock físico - Stock reservado activo.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Activa'),
        ('RELEASED', 'Liberada'),
        ('CONSUMED', 'Consumida en Venta'),
    ]

    quotation = models.ForeignKey(Quotation, related_name='stock_reservations', on_delete=models.CASCADE)
    product = models.ForeignKey('inventory.Product', related_name='stock_reservations', on_delete=models.CASCADE)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE)
    quantity = models.DecimalField("Cantidad Reservada", max_digits=12, decimal_places=2)
    status = models.CharField("Estado Reserva", max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    expires_at = models.DateTimeField("Fecha Límite Reserva", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField("Liberado en", null=True, blank=True)

    class Meta:
        verbose_name = "Reserva de Stock"
        verbose_name_plural = "Reservas de Stock"
        indexes = [
            models.Index(fields=['product', 'status']),
            models.Index(fields=['expires_at', 'status']),
        ]

    def __str__(self):
        return f"Reserva {self.quantity} x {self.product.name} (Cot. {self.quotation.consecutive}) - {self.status}"


class QuotationAuditLog(models.Model):
    """
    Registro histórico de eventos y cambios en cotizaciones.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Creación'),
        ('EDIT', 'Modificación'),
        ('REVISION', 'Nueva Versión'),
        ('SEND', 'Enviada al Cliente'),
        ('APPROVE', 'Aprobada'),
        ('REJECT', 'Rechazada'),
        ('EXPIRE', 'Vencida'),
        ('CONVERT', 'Convertida en Venta'),
        ('CANCEL', 'Cancelada'),
        ('RESERVE_STOCK', 'Reserva de Stock'),
        ('RELEASE_STOCK', 'Liberación de Stock'),
        ('PRICE_OVERRIDE', 'Modificación de Precios'),
    ]

    quotation = models.ForeignKey(Quotation, related_name='audit_logs', on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField("Acción", max_length=50, choices=ACTION_CHOICES)
    description = models.TextField("Descripción del Evento")
    changes = models.JSONField("Detalle de Cambios", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registro de Auditoría de Cotización"
        verbose_name_plural = "Registros de Auditoría de Cotizaciones"
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.action} - Cot {self.quotation.consecutive}"
