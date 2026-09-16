from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('SUPERADMIN', 'Super Administrador'),
        ('ADMIN', 'Administrador'),
        ('CASHIER', 'Cajero'),
        ('USER', 'Usuario'),
        ('SUPPLIER', 'Proveedor'),
        ('DELIVERY', 'Domiciliario'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='USER')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_2fa_enabled = models.BooleanField(default=False)
    custom_permissions = models.JSONField(default=dict, blank=True)
    
    # Required for resolving clashes if multiple apps are using AbstractUser
    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to.',
        related_name="custom_user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="custom_user_set",
        related_query_name="user",
    )

    def __str__(self):
        return f"{self.username} - {self.role}"

class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.key

