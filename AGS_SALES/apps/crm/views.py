from rest_framework import viewsets, permissions
from .models import Customer, CustomerSegment
from .serializers import CustomerSerializer, CustomerSegmentSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['first_name', 'last_name', 'email', 'document_number', 'phone']
    filterset_fields = ['is_active', 'city']

class CustomerSegmentViewSet(viewsets.ModelViewSet):
    queryset = CustomerSegment.objects.all()
    serializer_class = CustomerSegmentSerializer
    permission_classes = [permissions.IsAuthenticated]
