from django.contrib import admin
from django.db import models
from .models import Category, Brand, Product, Warehouse, Stock, Kardex

@admin.action(description='Generar Códigos de Barra para los seleccionados')
def generate_barcodes(modeladmin, request, queryset):
    count = 0
    for p in queryset.filter(models.Q(barcode__isnull=True) | models.Q(barcode='')):
        p.barcode = f"GH{str(p.id).zfill(8)}"
        p.save()
        count += 1
    modeladmin.message_user(request, f'Se generaron códigos de barra para {count} productos.')

class ProductAdmin(admin.ModelAdmin):
    list_display = ('internal_code', 'name', 'barcode', 'price_buy', 'price_sell', 'stock', 'is_active')
    actions = [generate_barcodes]

admin.site.register(Category)
admin.site.register(Brand)
admin.site.register(Product, ProductAdmin)
admin.site.register(Warehouse)
admin.site.register(Stock)
admin.site.register(Kardex)
