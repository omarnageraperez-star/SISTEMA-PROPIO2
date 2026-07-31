from rest_framework import viewsets, permissions
from .models import Provider, PurchaseOrder, PurchaseOrderDetail
from .serializers import ProviderSerializer, PurchaseOrderSerializer, PurchaseOrderDetailSerializer

class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['name', 'contact_name', 'email', 'tax_id']
    filterset_fields = ['is_active']

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'provider']

class PurchaseOrderDetailViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrderDetail.objects.all()
    serializer_class = PurchaseOrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['order', 'product']
