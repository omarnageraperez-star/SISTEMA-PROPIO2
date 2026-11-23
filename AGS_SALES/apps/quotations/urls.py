from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QuotationViewSet, QuotationConfigurationViewSet, ExtraTemplateViewSet
)

router = DefaultRouter()
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'configuration', QuotationConfigurationViewSet, basename='quotation-configuration')
router.register(r'templates', ExtraTemplateViewSet, basename='quotation-template')

urlpatterns = [
    path('', include(router.urls)),
]
