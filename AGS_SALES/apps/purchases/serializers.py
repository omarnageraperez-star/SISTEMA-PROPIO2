from rest_framework import serializers
from .models import Provider, PurchaseOrder, PurchaseOrderDetail

class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = '__all__'

class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    provider_name = serializers.ReadOnlyField(source='order.provider.name')
    order_date = serializers.ReadOnlyField(source='order.order_date')

    class Meta:
        model = PurchaseOrderDetail
        fields = '__all__'

class PurchaseOrderSerializer(serializers.ModelSerializer):
    details = PurchaseOrderDetailSerializer(many=True, read_only=True)
    provider_name = serializers.ReadOnlyField(source='provider.name')

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

class PriceHistorySerializer(serializers.Serializer):
    date = serializers.DateField()
    provider = serializers.CharField()
    provider_id = serializers.IntegerField()
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_price = serializers.DecimalField(max_digits=15, decimal_places=2)

class PriceComparisonSerializer(serializers.Serializer):
    provider = serializers.CharField()
    provider_id = serializers.IntegerField()
    avg_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    min_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    max_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    purchase_count = serializers.IntegerField()

class PriceTrendSerializer(serializers.Serializer):
    date = serializers.DateField()
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    variation_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    provider = serializers.CharField()

class PurchaseAnalyticsSerializer(serializers.Serializer):
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_orders = serializers.IntegerField()
    top_provider = serializers.CharField()
    top_product = serializers.CharField()
    avg_order_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    price_variation_products = serializers.IntegerField()
