from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, SystemSetting

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['username', 'email', 'role', 'is_staff', 'is_active']
    fieldsets = UserAdmin.fieldsets + (
        ('Custom Info', {'fields': ('role', 'phone_number', 'avatar', 'is_2fa_enabled')}),
    )

admin.site.register(User, CustomUserAdmin)

@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value']
    search_fields = ['key']

