from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProviderViewSet, PurchaseOrderViewSet, PurchaseOrderDetailViewSet

router = DefaultRouter()
router.register(r'providers', ProviderViewSet)
router.register(r'orders', PurchaseOrderViewSet)
router.register(r'order-details', PurchaseOrderDetailViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
