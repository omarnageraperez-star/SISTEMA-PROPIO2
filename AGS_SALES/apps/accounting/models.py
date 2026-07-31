from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class CashRegister(models.Model):
    name = models.CharField(max_length=100) # e.g. Caja Principal, Caja Web
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Caja Registradora"
        verbose_name_plural = "Cajas Registradoras"

    def __str__(self):
        return self.name

class CashShift(models.Model):
    cash_register = models.ForeignKey(CashRegister, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(blank=True, null=True)
    
    initial_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    final_balance = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    is_open = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Turno de Caja"
        verbose_name_plural = "Turnos de Caja"

    def __str__(self):
        return f"Shift {self.id} - {self.cash_register.name} ({self.user.username})"

class CashMovement(models.Model):
    MOVEMENT_CHOICES = [
        ('IN', 'Ingreso'),
        ('OUT', 'Egreso'),
    ]

    shift = models.ForeignKey(CashShift, related_name='movements', on_delete=models.CASCADE)
    type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Movimiento de Caja"
        verbose_name_plural = "Movimientos de Caja"

    def __str__(self):
        return f"{self.type} - {self.amount} ({self.shift})"

class CompanyAsset(models.Model):
    ASSET_TYPE_CHOICES = [
        ('EQUIPMENT', 'Equipo'),
        ('ELECTRONICS', 'Electrónica'),
        ('FURNITURE', 'Mobiliario'),
        ('VEHICLE', 'Vehículo'),
        ('PROPERTY', 'Inmueble'),
        ('OTHER', 'Otro'),
    ]

    CONDITION_CHOICES = [
        ('NEW', 'Nuevo'),
        ('GOOD', 'Bueno'),
        ('FAIR', 'Regular'),
        ('POOR', 'Malo'),
    ]

    name = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=50, choices=ASSET_TYPE_CHOICES, default='EQUIPMENT')
    serial_number = models.CharField(max_length=100, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    purchase_date = models.DateField(blank=True, null=True)
    location = models.CharField(max_length=150, blank=True, null=True)
    assigned_to = models.CharField(max_length=150, blank=True, null=True)
    condition = models.CharField(max_length=50, choices=CONDITION_CHOICES, default='NEW')
    notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Activo de la Empresa"
        verbose_name_plural = "Activos de la Empresa"

    def __str__(self):
        return f"{self.name} - {self.serial_number or 'Sin Serie'}"

