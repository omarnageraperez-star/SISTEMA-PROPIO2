from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"

    def __str__(self):
        return self.name

class Brand(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"

    def __str__(self):
        return self.name

class Product(models.Model):
    category = models.ForeignKey(Category, related_name='products', on_delete=models.SET_NULL, null=True)
    brand = models.ForeignKey(Brand, related_name='products', on_delete=models.SET_NULL, null=True)
    provider = models.ForeignKey('purchases.Provider', related_name='products', on_delete=models.SET_NULL, null=True, blank=True)
    internal_code = models.CharField(max_length=50, unique=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)
    sku = models.CharField(max_length=100, blank=True, null=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=150, blank=True, null=True)
    measurement_unit = models.CharField(max_length=50, default='Unidad') # 'Unidad' or 'A Granel'
    has_inventory_control = models.BooleanField(default=True)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profit_margin = models.DecimalField(max_digits=5, decimal_places=2, default=0) # Margin in %
    price_buy = models.DecimalField(max_digits=12, decimal_places=2, default=0) # cost price
    price_sell = models.DecimalField(max_digits=12, decimal_places=2, default=0) # selling price
    wholesale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0) # wholesale price
    image = models.TextField(blank=True, null=True)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    weight = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Weight in kg')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"

    def save(self, *args, **kwargs):
        try:
            from apps.users.models import SystemSetting
            decimals_setting = SystemSetting.objects.filter(key='currency_decimals').first()
            decimals = int(decimals_setting.value) if decimals_setting and decimals_setting.value.isdigit() else 2
        except Exception:
            decimals = 2
            
        if self.price_buy is not None:
            self.price_buy = round(self.price_buy, decimals)
        if self.price_sell is not None:
            self.price_sell = round(self.price_sell, decimals)
        if self.wholesale_price is not None:
            self.wholesale_price = round(self.wholesale_price, decimals)
            
        super().save(*args, **kwargs)
        try:
            # Sync product stock with default warehouse stock
            default_warehouse, _ = Warehouse.objects.get_or_create(name='Bodega Principal', defaults={'location': 'Central'})
            Stock.objects.update_or_create(
                product=self,
                warehouse=default_warehouse,
                defaults={
                    'quantity': self.stock,
                    'min_stock': self.min_stock
                }
            )
        except Exception as e:
            print("Error syncing stock:", e)

    def __str__(self):
        return f"[{self.internal_code}] {self.name}"

class Warehouse(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Bodega"
        verbose_name_plural = "Bodegas"

    def __str__(self):
        return self.name

class Stock(models.Model):
    product = models.ForeignKey(Product, related_name='stocks', on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, related_name='stocks', on_delete=models.CASCADE)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ('product', 'warehouse')
        verbose_name = "Inventario (Stock)"
        verbose_name_plural = "Inventarios (Stock)"

    def __str__(self):
        return f"{self.product.name} at {self.warehouse.name}: {self.quantity}"

class Kardex(models.Model):
    MOVEMENT_TYPES = [
        ('IN', 'Ingreso'),
        ('OUT', 'Salida'),
        ('TRANSFER', 'Transferencia'),
    ]

    product = models.ForeignKey(Product, related_name='kardex', on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, related_name='kardex', on_delete=models.CASCADE)
    movement_type = models.CharField(max_length=10, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True, null=True, help_text='Bill, Order or Transfer Ref')
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Movimiento Kardex"
        verbose_name_plural = "Movimientos Kardex"

    def __str__(self):
        return f"{self.movement_type} - {self.product.name} ({self.quantity})"
