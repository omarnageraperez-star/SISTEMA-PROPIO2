from rest_framework import viewsets, permissions
from .models import PaymentMethod, Sale, SaleDetail, Payment
from .serializers import (
    PaymentMethodSerializer, SaleSerializer,
    SaleDetailSerializer, PaymentSerializer
)

class PaymentMethodViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all().order_by('-created_at')
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'customer', 'warehouse']
    search_fields = ['invoice_number']

class SaleDetailViewSet(viewsets.ModelViewSet):
    queryset = SaleDetail.objects.all()
    serializer_class = SaleDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
