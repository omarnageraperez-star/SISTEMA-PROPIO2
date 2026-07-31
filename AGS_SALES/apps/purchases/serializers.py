from rest_framework import serializers
from .models import Provider, PurchaseOrder, PurchaseOrderDetail

class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = '__all__'

class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = PurchaseOrderDetail
        fields = '__all__'

class PurchaseOrderSerializer(serializers.ModelSerializer):
    details = PurchaseOrderDetailSerializer(many=True, read_only=True)
    provider_name = serializers.ReadOnlyField(source='provider.name')

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
