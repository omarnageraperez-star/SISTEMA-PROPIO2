from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TableViewSet, CatalogOrderViewSet, customer_login_view, customer_register_view, customer_dashboard_view
from .customer_auth import (
    customer_register, customer_login, customer_profile,
    customer_update_profile, customer_logout
)

router = DefaultRouter()
router.register(r'tables', TableViewSet, basename='table')
router.register(r'orders', CatalogOrderViewSet, basename='catalogorder')

urlpatterns = [
    path('', include(router.urls)),
    # Endpoints de autenticación de clientes (API)
    path('auth/register/', customer_register, name='customer_register'),
    path('auth/login/', customer_login, name='customer_login'),
    path('auth/profile/', customer_profile, name='customer_profile'),
    path('auth/profile/update/', customer_update_profile, name='customer_update_profile'),
    path('auth/logout/', customer_logout, name='customer_logout'),
    # Páginas de autenticación de clientes (Django)
    path('login/', customer_login_view, name='customer_login_page'),
    path('registro/', customer_register_view, name='customer_register_page'),
    path('cliente/', customer_dashboard_view, name='customer_dashboard'),
]
