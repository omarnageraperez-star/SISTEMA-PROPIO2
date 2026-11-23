from django.contrib import admin
from .models import (
    QuotationConfiguration, Quotation, QuotationItem, QuotationItemExtra,
    QuotationItemCustomization, ExtraTemplate, StockReservation, QuotationAuditLog
)

class QuotationItemExtraInline(admin.TabularInline):
    model = QuotationItemExtra
    extra = 0

class QuotationItemCustomizationInline(admin.TabularInline):
    model = QuotationItemCustomization
    extra = 0

class QuotationItemInline(admin.StackedInline):
    model = QuotationItem
    extra = 0
    show_change_link = True

class QuotationAuditLogInline(admin.TabularInline):
    model = QuotationAuditLog
    extra = 0
    readonly_fields = ('created_at', 'action', 'user', 'description', 'changes')
    can_delete = False

@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('consecutive', 'version', 'customer_name', 'status', 'issue_date', 'valid_until', 'total', 'user')
    list_filter = ('status', 'issue_date', 'valid_until')
    search_fields = ('consecutive', 'customer_name', 'customer_document', 'customer_email')
    inlines = [QuotationItemInline, QuotationAuditLogInline]
    readonly_fields = ('consecutive', 'created_at', 'updated_at')

@admin.register(QuotationConfiguration)
class QuotationConfigurationAdmin(admin.ModelAdmin):
    list_display = ('consecutive_prefix', 'consecutive_include_year', 'next_number', 'default_validity_days', 'enable_stock_reservation')

@admin.register(ExtraTemplate)
class ExtraTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'category', 'product', 'is_active')
    list_filter = ('template_type', 'is_active')

@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ('quotation', 'product', 'warehouse', 'quantity', 'status', 'expires_at')
    list_filter = ('status', 'expires_at')
