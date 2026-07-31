from django.contrib import admin
from .models import BillingConfiguration, DIANResolution, DIANCertificate

@admin.register(BillingConfiguration)
class BillingConfigurationAdmin(admin.ModelAdmin):
    list_display = ('get_dian_environment_display', 'default_mode', 'allow_pos', 'allow_electronic', 'updated_at')
    
    # We only want one configuration globally
    def has_add_permission(self, request):
        if self.model.objects.count() >= 1:
            return False
        return super().has_add_permission(request)

@admin.register(DIANResolution)
class DIANResolutionAdmin(admin.ModelAdmin):
    list_display = ('resolution_number', 'resolution_type', 'prefix', 'start_range', 'end_range', 'current_number', 'is_active', 'valid_to')
    list_filter = ('resolution_type', 'is_active')
    search_fields = ('resolution_number', 'prefix')

@admin.register(DIANCertificate)
class DIANCertificateAdmin(admin.ModelAdmin):
    list_display = ('name', 'expiration_date', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)
