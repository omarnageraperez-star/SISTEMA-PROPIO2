from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TableViewSet, CatalogOrderViewSet

router = DefaultRouter()
router.register(r'tables', TableViewSet, basename='table')
router.register(r'orders', CatalogOrderViewSet, basename='catalogorder')

urlpatterns = [
    path('', include(router.urls)),
]
