from rest_framework import serializers
from .models import Table, CatalogOrder, CatalogOrderItem
from apps.inventory.models import Product
from apps.inventory.serializers import ProductSerializer

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ['id', 'name', 'qr_code', 'location', 'is_active', 'created_at']
        read_only_fields = ['created_at']

class CatalogOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = CatalogOrderItem
        fields = ['id', 'order', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal', 'notes']
        read_only_fields = ['subtotal']

class CatalogOrderSerializer(serializers.ModelSerializer):
    items = CatalogOrderItemSerializer(many=True, read_only=True)
    table_name = serializers.CharField(source='table.name', read_only=True)
    
    class Meta:
        model = CatalogOrder
        fields = [
            'id', 'order_number', 'table', 'table_name', 'customer_name', 
            'customer_phone', 'customer_address', 'order_type', 'status', 
            'payment_method', 'notes', 'subtotal', 'tax', 'total', 
            'created_at', 'confirmed_at', 'delivered_at', 'processed_by', 
            'related_sale', 'items'
        ]
        read_only_fields = ['order_number', 'subtotal', 'tax', 'total', 'created_at', 'confirmed_at', 'delivered_at']

class CreateCatalogOrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = CatalogOrderItem
        fields = ['product', 'product_name', 'quantity', 'unit_price', 'notes']

class CreateCatalogOrderSerializer(serializers.ModelSerializer):
    items = CreateCatalogOrderItemSerializer(many=True, write_only=True)
    
    class Meta:
        model = CatalogOrder
        fields = [
            'table', 'customer_name', 'customer_phone', 'customer_address',
            'order_type', 'payment_method', 'notes', 'items'
        ]
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = CatalogOrder.objects.create(**validated_data)
        
        # Calculate totals
        subtotal = 0
        tax = 0
        
        for item_data in items_data:
            product = item_data.get('product')
            quantity = item_data.get('quantity')
            unit_price = item_data.get('unit_price')
            
            # Get product name from product or use provided name
            if product:
                item_data['product_name'] = product.name
                product_tax = product.tax_percent or 0
            else:
                product_tax = 0
            
            item = CatalogOrderItem.objects.create(order=order, **item_data)
            subtotal += item.subtotal
                                
            # Calculate tax for this item
            item_tax = item.subtotal * (product_tax / 100)
            tax += item_tax
        
        order.subtotal = subtotal
        order.tax = tax
        order.total = subtotal + tax
        order.save()
        
        return order

class UpdateCatalogOrderStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogOrder
        fields = ['status', 'processed_by']
