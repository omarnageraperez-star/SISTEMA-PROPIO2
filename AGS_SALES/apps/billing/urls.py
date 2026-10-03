from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BillingConfigurationView, TaxViewSet

router = DefaultRouter()
router.register(r'taxes', TaxViewSet)

urlpatterns = [
    path('', BillingConfigurationView.as_view(), name='billing-config'),
    path('', include(router.urls)),
]
