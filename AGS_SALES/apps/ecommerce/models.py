from django.db import models
from django.contrib.auth import get_user_model
from apps.inventory.models import Product

User = get_user_model()

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart', null=True, blank=True)
    session_id = models.CharField(max_length=100, blank=True, null=True) # For guest users
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Carrito"
        verbose_name_plural = "Carritos"

    def __str__(self):
        return f"Cart {self.id} - User: {self.user}"

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    
    class Meta:
        verbose_name = "Ítem de Carrito"
        verbose_name_plural = "Ítems de Carrito"

    def __str__(self):
        return f"{self.quantity} of {self.product.name}"

class WebOrder(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente de Pago'),
        ('PAID', 'Pagado'),
        ('SHIPPED', 'Enviado'),
        ('DELIVERED', 'Entregado'),
        ('CANCELLED', 'Cancelado'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    # Ideally links to a shipping address model in CRM
    shipping_address = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pedido Web"
        verbose_name_plural = "Pedidos Web"

    def __str__(self):
        return f"WebOrder {self.id} - {self.status}"
