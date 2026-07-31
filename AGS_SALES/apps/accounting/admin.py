from django.contrib import admin
from .models import CashRegister, CashShift, CashMovement

admin.site.register(CashRegister)
admin.site.register(CashShift)
admin.site.register(CashMovement)
