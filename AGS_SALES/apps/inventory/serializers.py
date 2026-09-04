from rest_framework import serializers
from .models import Category, Brand, Product, Warehouse, Stock, Kardex

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'

from datetime import date

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    brand_name = serializers.ReadOnlyField(source='brand.name')
    days_until_expiration = serializers.SerializerMethodField()
    expiration_status = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'

    def get_days_until_expiration(self, obj):
        if not obj.expiration_date:
            return None
        return (obj.expiration_date - date.today()).days

    def get_expiration_status(self, obj):
        if not obj.expiration_date:
            return 'NONE'
        diff = (obj.expiration_date - date.today()).days
        if diff < 0:
            return 'EXPIRED'
        elif diff <= 7:
            return 'CRITICAL'
        elif diff <= 30:
            return 'WARNING'
        return 'OK'

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = Stock
        fields = '__all__'

class KardexSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')

    class Meta:
        model = Kardex
        fields = '__all__'
