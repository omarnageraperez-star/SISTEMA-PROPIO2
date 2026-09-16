from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TableViewSet, CatalogOrderViewSet, CustomerAuthViewSet, customer_login_view, customer_register_view, customer_dashboard_view, customer_logout_view

router = DefaultRouter()
router.register(r'tables', TableViewSet, basename='table')
router.register(r'orders', CatalogOrderViewSet, basename='catalogorder')
router.register(r'customer-auth', CustomerAuthViewSet, basename='customer_auth')

urlpatterns = [
    path('', include(router.urls)),
    # Páginas de autenticación de clientes (Django)
    path('login/', customer_login_view, name='customer_login_page'),
    path('registro/', customer_register_view, name='customer_register_page'),
    path('cliente/', customer_dashboard_view, name='customer_dashboard'),
    path('logout/', customer_logout_view, name='customer_logout'),
]
