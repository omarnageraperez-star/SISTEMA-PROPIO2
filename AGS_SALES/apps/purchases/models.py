from django.db import models
from apps.inventory.models import Product

class Provider(models.Model):
    name = models.CharField(max_length=150)
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    tax_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"

    def __str__(self):
        return self.name

class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Borrador'),
        ('SENT', 'Enviada'),
        ('RECEIVED', 'Recibida'),
        ('CANCELLED', 'Cancelada'),
    ]

    provider = models.ForeignKey(Provider, related_name='orders', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    order_date = models.DateField(auto_now_add=True)
    expected_date = models.DateField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    processed_stock = models.BooleanField("Stock Procesado", default=False)

    class Meta:
        verbose_name = "Orden de Compra"
        verbose_name_plural = "Ordenes de Compra"

    def __str__(self):
        return f"PO-{self.id} - {self.provider.name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.status == 'RECEIVED' and not self.processed_stock:
            from apps.inventory.models import Warehouse, Kardex
            default_warehouse, _ = Warehouse.objects.get_or_create(
                name='Bodega Principal', 
                defaults={'location': 'Central'}
            )
            for detail in self.details.all():
                product = detail.product
                product.stock += detail.quantity
                product.save()

                Kardex.objects.create(
                    product=product,
                    warehouse=default_warehouse,
                    movement_type='IN',
                    quantity=detail.quantity,
                    reference=f"Orden de Compra PO-{self.id}"
                )
            self.processed_stock = True
            PurchaseOrder.objects.filter(pk=self.pk).update(processed_stock=True)

class PurchaseOrderDetail(models.Model):
    order = models.ForeignKey(PurchaseOrder, related_name='details', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=15, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Detalle de Orden"
        verbose_name_plural = "Detalles de Orden"

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"
