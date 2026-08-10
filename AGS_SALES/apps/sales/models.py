from django.db import models
from django.contrib.auth import get_user_model
from apps.inventory.models import Product, Warehouse
from apps.crm.models import Customer

User = get_user_model()

class PaymentMethod(models.Model):
    name = models.CharField(max_length=50) # Cash, Card, Transfer, etc.
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Método de Pago"
        verbose_name_plural = "Métodos de Pago"

    def __str__(self):
        return self.name

class Sale(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('COMPLETED', 'Completada'),
        ('CANCELLED', 'Anulada'),
    ]

    INVOICE_TYPE_CHOICES = [
        ('POS', 'POS Electrónico'),
        ('ELECTRONIC', 'Factura Electrónica'),
    ]

    DIAN_STATUS_CHOICES = [
        ('NONE', 'No Aplica'),
        ('PENDING', 'Pendiente de Envío'),
        ('ACCEPTED', 'Aceptada por DIAN'),
        ('REJECTED', 'Rechazada por DIAN'),
    ]

    user = models.ForeignKey(User, related_name='sales', on_delete=models.SET_NULL, null=True)
    customer = models.ForeignKey(Customer, related_name='sales', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    invoice_number = models.CharField(max_length=100, blank=True, null=True, unique=True)
    
    # Billing/DIAN fields
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPE_CHOICES, default='POS')
    dian_status = models.CharField(max_length=20, choices=DIAN_STATUS_CHOICES, default='NONE')
    cufe = models.CharField(max_length=255, blank=True, null=True)
    xml_file = models.FileField(upload_to='dian/xml/', blank=True, null=True)
    pdf_file = models.FileField(upload_to='dian/pdf/', blank=True, null=True)
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    promo_percent = models.IntegerField(default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Credit/Financing fields
    is_credit = models.BooleanField(default=False)
    credit_status = models.CharField(
        max_length=20, 
        choices=[('PENDING', 'Pendiente'), ('PARTIAL', 'Abonado parcial'), ('PAID', 'Pagado')], 
        default='PENDING'
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_date = models.DateField(null=True, blank=True)
    credit_notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Venta (POS)"
        verbose_name_plural = "Ventas (POS)"

    def __str__(self):
        return f"Sale {self.id} - {self.total}"

class SaleDetail(models.Model):
    sale = models.ForeignKey(Sale, related_name='details', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.subtotal = (self.quantity * self.unit_price) - self.discount
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Detalle de Venta"
        verbose_name_plural = "Detalles de Venta"

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"

class Payment(models.Model):
    sale = models.ForeignKey(Sale, related_name='payments', on_delete=models.CASCADE)
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"

    def __str__(self):
        return f"{self.payment_method.name}: {self.amount}"

class CreditPayment(models.Model):
    sale = models.ForeignKey(Sale, related_name='credit_payments', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.TextField(blank=True, default='')
    paid_at = models.DateTimeField(auto_now_add=True)
    registered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Abono de Crédito"
        verbose_name_plural = "Abonos de Crédito"

    def __str__(self):
        return f"Abono {self.amount} para Venta {self.sale.id}"
