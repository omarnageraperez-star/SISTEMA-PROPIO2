from django.contrib import admin
from .models import Provider, PurchaseOrder, PurchaseOrderDetail

admin.site.register(Provider)
admin.site.register(PurchaseOrder)
admin.site.register(PurchaseOrderDetail)
