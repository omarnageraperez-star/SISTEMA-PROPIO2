from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentMethodViewSet, SaleViewSet, SaleDetailViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'payment-methods', PaymentMethodViewSet)
router.register(r'sales', SaleViewSet)
router.register(r'sale-details', SaleDetailViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
