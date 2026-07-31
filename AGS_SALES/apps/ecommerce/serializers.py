from rest_framework import serializers
from .models import Cart, CartItem, WebOrder
from apps.inventory.serializers import ProductSerializer

class CartItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)

    class Meta:
        model = CartItem
        fields = '__all__'

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = '__all__'

class WebOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebOrder
        fields = '__all__'
