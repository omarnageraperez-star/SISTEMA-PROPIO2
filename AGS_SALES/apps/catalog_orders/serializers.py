from rest_framework import serializers
from decimal import Decimal
from django.contrib.auth import authenticate
from .models import Table, CatalogOrder, CatalogOrderItem, CustomerUser
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
    customer_user_info = serializers.SerializerMethodField()
    
    class Meta:
        model = CatalogOrder
        fields = [
            'id', 'order_number', 'table', 'table_name', 'customer_user', 'customer_user_info',
            'customer_name', 'customer_phone', 'customer_address', 'order_type', 'status', 
            'payment_method', 'notes', 'subtotal', 'tax', 'total', 
            'created_at', 'confirmed_at', 'delivered_at', 'processed_by', 
            'related_sale', 'items', 'delivery_photo', 'rating', 'customer_feedback'
        ]
        read_only_fields = ['order_number', 'subtotal', 'tax', 'total', 'created_at', 'confirmed_at', 'delivered_at']
    
    def get_customer_user_info(self, obj):
        if obj.customer_user:
            return {
                'id': obj.customer_user.id,
                'username': obj.customer_user.username,
                'full_name': obj.customer_user.get_full_name()
            }
        return None

class CreateCatalogOrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), required=False, allow_null=True)
    product_name = serializers.CharField(required=True, allow_blank=False)
    
    class Meta:
        model = CatalogOrderItem
        fields = ['product', 'product_name', 'quantity', 'unit_price', 'notes']

class CreateCatalogOrderSerializer(serializers.ModelSerializer):
    items = CreateCatalogOrderItemSerializer(many=True, write_only=True)
    customer_user = serializers.PrimaryKeyRelatedField(queryset=CustomerUser.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = CatalogOrder
        fields = [
            'table', 'customer_user', 'customer_name', 'customer_phone', 'customer_address',
            'order_type', 'payment_method', 'notes', 'items'
        ]
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = CatalogOrder.objects.create(**validated_data)
        
        # Calculate totals
        subtotal = Decimal('0')
        tax = Decimal('0')
        
        for item_data in items_data:
            product = item_data.get('product')
            quantity = item_data.get('quantity')
            unit_price = item_data.get('unit_price')
            
            # Convert to Decimal if they are floats
            if quantity is not None:
                quantity = Decimal(str(quantity))
            if unit_price is not None:
                unit_price = Decimal(str(unit_price))
            
            # Get product name from product or use provided name
            if product:
                item_data['product_name'] = product.name
                product_tax = Decimal(str(product.tax_percent or 0))
            else:
                product_tax = Decimal('0')
            
            item = CatalogOrderItem.objects.create(order=order, **item_data)
            subtotal += item.subtotal
                                
            # Calculate tax for this item
            item_tax = item.subtotal * (product_tax / Decimal('100'))
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
    
    def validate_status(self, value):
        # Prevenir que se actualice al mismo estado
        if self.instance and self.instance.status == value:
            raise serializers.ValidationError(f"El pedido ya está en estado {value}")
        return value

class CustomerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    
    class Meta:
        model = CustomerUser
        fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'address', 'password', 'password_confirm']
        extra_kwargs = {
            'email': {'required': True}
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Las contraseñas no coinciden"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = CustomerUser.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

class CustomerLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True, style={'input_type': 'password'})
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username and password:
            # Intentar autenticar con CustomerUser primero
            from .models import CustomerUser
            try:
                user = CustomerUser.objects.get(username=username)
                if user.check_password(password):
                    if not user.is_active:
                        raise serializers.ValidationError({"username": "Usuario inactivo"})
                    attrs['user'] = user
                    return attrs
            except CustomerUser.DoesNotExist:
                pass
            
            # Si no es CustomerUser, intentar con el User por defecto
            user = authenticate(username=username, password=password)
            if user:
                if not user.is_active:
                    raise serializers.ValidationError({"username": "Usuario inactivo"})
                attrs['user'] = user
                return attrs
            
            raise serializers.ValidationError({"username": "Credenciales inválidas"})
        else:
            raise serializers.ValidationError({"username": "Se requieren username y password"})

class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone', 'address', 'is_verified', 'created_at']
        read_only_fields = ['id', 'is_verified', 'created_at']
