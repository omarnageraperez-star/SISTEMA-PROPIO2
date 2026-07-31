from django.contrib import admin
from .models import PaymentMethod, Sale, SaleDetail, Payment

class SaleDetailInline(admin.TabularInline):
    model = SaleDetail
    extra = 1

class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 1

class SaleAdmin(admin.ModelAdmin):
    inlines = [SaleDetailInline, PaymentInline]
    list_display = ('id', 'invoice_number', 'customer', 'status', 'total', 'created_at')

admin.site.register(PaymentMethod)
admin.site.register(Sale, SaleAdmin)
admin.site.register(SaleDetail)
admin.site.register(Payment)
