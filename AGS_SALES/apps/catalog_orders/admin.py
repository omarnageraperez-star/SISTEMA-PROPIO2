from django.contrib import admin
from django.utils.html import format_html
from .models import Table, CatalogOrder, CatalogOrderItem

class CatalogOrderItemInline(admin.TabularInline):
    model = CatalogOrderItem
    extra = 0
    readonly_fields = ('subtotal',)
    fields = ('product', 'product_name', 'quantity', 'unit_price', 'subtotal', 'notes')

@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'qr_code', 'is_active', 'created_at', 'qr_link')
    list_filter = ('is_active', 'location')
    search_fields = ('name', 'qr_code', 'location')
    readonly_fields = ('created_at', 'qr_link')
    
    def qr_link(self, obj):
        if obj.qr_code:
            catalog_url = f"/catalogo/?table={obj.qr_code}"
            return format_html(
                '<a href="{}" target="_blank" class="button">Abrir Catálogo con Mesa</a>',
                catalog_url
            )
        return "Sin QR"
    qr_link.short_description = "Enlace al Catálogo"
    
    def save_model(self, request, obj, form, change):
        if not obj.qr_code:
            import uuid
            import secrets
            obj.qr_code = secrets.token_urlsafe(16).upper()
        super().save_model(request, obj, form, change)

@admin.register(CatalogOrder)
class CatalogOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer_name', 'table', 'order_type', 'status', 'total', 'created_at')
    list_filter = ('status', 'order_type', 'payment_method', 'created_at')
    search_fields = ('order_number', 'customer_name', 'customer_phone')
    readonly_fields = ('order_number', 'subtotal', 'tax', 'total', 'created_at', 'confirmed_at', 'delivered_at')
    inlines = [CatalogOrderItemInline]
    
    fieldsets = (
        ('Información del Pedido', {
            'fields': ('order_number', 'status', 'order_type', 'payment_method')
        }),
        ('Cliente', {
            'fields': ('customer_name', 'customer_phone', 'customer_address', 'table')
        }),
        ('Totales', {
            'fields': ('subtotal', 'tax', 'total')
        }),
        ('Tiempos', {
            'fields': ('created_at', 'confirmed_at', 'delivered_at')
        }),
        ('Procesamiento', {
            'fields': ('processed_by', 'related_sale', 'notes')
        }),
    )

@admin.register(CatalogOrderItem)
class CatalogOrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product_name', 'quantity', 'unit_price', 'subtotal')
    list_filter = ('order__status',)
    search_fields = ('product_name', 'order__order_number')
    readonly_fields = ('subtotal',)
