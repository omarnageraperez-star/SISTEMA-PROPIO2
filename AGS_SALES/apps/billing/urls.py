from django.urls import path
from .views import BillingConfigurationView

urlpatterns = [
    path('', BillingConfigurationView.as_view(), name='billing-config'),
]
