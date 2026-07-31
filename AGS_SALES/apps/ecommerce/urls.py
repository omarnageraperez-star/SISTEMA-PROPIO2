from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CartViewSet, CartItemViewSet, WebOrderViewSet

router = DefaultRouter()
router.register(r'carts', CartViewSet)
router.register(r'cart-items', CartItemViewSet)
router.register(r'web-orders', WebOrderViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
