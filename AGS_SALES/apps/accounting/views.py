from rest_framework import viewsets, permissions
from .models import CashRegister, CashShift, CashMovement, CompanyAsset
from .serializers import CashRegisterSerializer, CashShiftSerializer, CashMovementSerializer, CompanyAssetSerializer

class CashRegisterViewSet(viewsets.ModelViewSet):
    queryset = CashRegister.objects.all()
    serializer_class = CashRegisterSerializer
    permission_classes = [permissions.IsAuthenticated]

class CashShiftViewSet(viewsets.ModelViewSet):
    queryset = CashShift.objects.all().order_by('-opened_at')
    serializer_class = CashShiftSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['is_open', 'user', 'cash_register']

class CashMovementViewSet(viewsets.ModelViewSet):
    queryset = CashMovement.objects.all().order_by('-created_at')
    serializer_class = CashMovementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['type', 'shift']

class CompanyAssetViewSet(viewsets.ModelViewSet):
    queryset = CompanyAsset.objects.all().order_by('-created_at')
    serializer_class = CompanyAssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['condition', 'asset_type']
