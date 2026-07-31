from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import CashRegisterOptionsView, OpenCashShiftView
from .views import CashRegisterViewSet, CashShiftViewSet, CashMovementViewSet, CompanyAssetViewSet

router = DefaultRouter()
router.register(r'cash-registers-list', CashRegisterViewSet)
router.register(r'cash-shifts', CashShiftViewSet)
router.register(r'cash-movements', CashMovementViewSet)
router.register(r'assets', CompanyAssetViewSet, basename='companyasset')

urlpatterns = [
    path('cash-registers/', CashRegisterOptionsView.as_view(), name='api_cash_registers'),
    path('cash-shifts/open/', OpenCashShiftView.as_view(), name='api_open_cash_shift'),
    path('', include(router.urls)),
]
