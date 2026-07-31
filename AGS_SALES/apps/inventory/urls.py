from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, BrandViewSet, ProductViewSet, WarehouseViewSet, StockViewSet, KardexViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'brands', BrandViewSet)
router.register(r'products', ProductViewSet)
router.register(r'warehouses', WarehouseViewSet)
router.register(r'stock', StockViewSet)
router.register(r'kardex', KardexViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
