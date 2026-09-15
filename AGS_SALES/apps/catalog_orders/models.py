from django.db import models
from django.contrib.auth import get_user_model
from apps.inventory.models import Product

User = get_user_model()

class Table(models.Model):
    """Representa una mesa/ubicación física con QR único"""
    name = models.CharField(max_length=100, verbose_name="Nombre de Mesa")
    qr_code = models.CharField(max_length=255, unique=True, verbose_name="Código QR")
    location = models.CharField(max_length=100, blank=True, null=True, verbose_name="Ubicación")
    is_active = models.BooleanField(default=True, verbose_name="Activa")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Mesa"
        verbose_name_plural = "Mesas"

    def __str__(self):
        return f"{self.name} ({self.location or 'Sin ubicación'})"

class CatalogOrder(models.Model):
    """Pedidos realizados desde el catálogo web"""
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('CONFIRMED', 'Confirmado'),
        ('PREPARING', 'En Preparación'),
        ('READY', 'Listo para Entregar'),
        ('DELIVERED', 'Entregado'),
        ('CANCELLED', 'Cancelado'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Efectivo al Recibir'),
        ('CARD', 'Tarjeta'),
        ('TRANSFER', 'Transferencia'),
    ]

    ORDER_TYPE_CHOICES = [
        ('DINE_IN', 'Consumo en Sitio'),
        ('TAKEOUT', 'Para Llevar'),
        ('DELIVERY', 'Domicilio'),
    ]

    # Identificación del pedido
    order_number = models.CharField(max_length=20, unique=True, verbose_name="Número de Pedido")
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Mesa")
    
    # Información del cliente
    customer_name = models.CharField(max_length=200, verbose_name="Nombre del Cliente")
    customer_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono")
    customer_address = models.TextField(blank=True, null=True, verbose_name="Dirección")
    
    # Detalles del pedido
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES, default='DINE_IN', verbose_name="Tipo de Pedido")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name="Estado")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='CASH', verbose_name="Método de Pago")
    
    # Notas adicionales
    notes = models.TextField(blank=True, null=True, verbose_name="Notas")
    
    # Totales
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Subtotal")
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Impuestos")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Total")
    
    # Control de tiempo
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name="Confirmado")
    delivered_at = models.DateTimeField(null=True, blank=True, verbose_name="Entregado")
    
    # Usuario que procesó el pedido (del sistema POS)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Procesado por")
    
    # Integración con venta del sistema
    related_sale = models.ForeignKey('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Venta Relacionada")

    class Meta:
        verbose_name = "Pedido del Catálogo"
        verbose_name_plural = "Pedidos del Catálogo"
        ordering = ['-created_at']

    def __str__(self):
        return f"Pedido #{self.order_number} - {self.customer_name}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            from django.utils import timezone
            import random
            date_str = timezone.now().strftime('%Y%m%d')
            random_num = random.randint(1000, 9999)
            self.order_number = f"CAT{date_str}{random_num}"
        super().save(*args, **kwargs)

class CatalogOrderItem(models.Model):
    """Items individuales de un pedido del catálogo"""
    order = models.ForeignKey(CatalogOrder, related_name='items', on_delete=models.CASCADE, verbose_name="Pedido")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, verbose_name="Producto")
    product_name = models.CharField(max_length=200, verbose_name="Nombre del Producto")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Cantidad")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Precio Unitario")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Subtotal")
    notes = models.TextField(blank=True, null=True, verbose_name="Notas del Item")

    class Meta:
        verbose_name = "Item de Pedido"
        verbose_name_plural = "Items de Pedido"

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"

    def save(self, *args, **kwargs):
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)
