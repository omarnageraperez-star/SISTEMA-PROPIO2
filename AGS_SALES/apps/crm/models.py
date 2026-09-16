from django.db import models

class Customer(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=191, unique=True, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    whatsapp = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    document_type = models.CharField(max_length=20, blank=True, null=True)
    document_number = models.CharField(max_length=50, blank=True, null=True, unique=True)
    
    # Fidelity
    points = models.IntegerField(default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Internal usage
    observations = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['document_number']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class CustomerSegment(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    customers = models.ManyToManyField(Customer, related_name='segments', blank=True)

    class Meta:
        verbose_name = "Segmento de Cliente"
        verbose_name_plural = "Segmentos de Clientes"

    def __str__(self):
        return self.name
