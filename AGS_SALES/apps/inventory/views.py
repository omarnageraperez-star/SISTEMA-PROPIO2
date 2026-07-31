from rest_framework import viewsets, permissions
from django.db import models
from .models import Category, Brand, Product, Warehouse, Stock, Kardex
from .serializers import (
    CategorySerializer, BrandSerializer, ProductSerializer, 
    WarehouseSerializer, StockSerializer, KardexSerializer
)

class IsSuperAdminOrReadOnly(permissions.BasePermission):
    """
    The request is authenticated as a user, or is a read-only request.
    Only SUPERADMINs can do unsafe methods (POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated and 
                   (request.user.role == 'SUPERADMIN' or request.user.is_superuser))

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [permissions.IsAuthenticated]

from rest_framework.decorators import action
from rest_framework.response import Response

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['category', 'brand', 'is_active']
    search_fields = ['name', 'internal_code', 'barcode', 'sku']

    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        action_type = request.data.get('action') # 'price_buy', 'price_sell', 'is_active', 'min_stock', 'max_stock', 'category', 'provider', 'delete'
        modifier_type = request.data.get('modifier_type') # 'value', 'fixed', 'percent', 'formula'
        value = request.data.get('value')
        product_ids = request.data.get('product_ids', [])
        
        try:
            from apps.users.models import SystemSetting
            decimals_setting = SystemSetting.objects.filter(key='currency_decimals').first()
            decimals = int(decimals_setting.value) if decimals_setting and decimals_setting.value.isdigit() else 2
        except Exception:
            decimals = 2
            
        if product_ids:
            products = Product.objects.filter(id__in=product_ids)
        else:
            products = Product.objects.all()
        
        if action_type == 'delete':
            count = products.count()
            products.delete()
            return Response({'success': True, 'message': f'Se eliminaron {count} productos del catálogo.'})
            
        count = 0
        for p in products:
            try:
                if action_type == 'price_buy':
                    val = float(value or 0)
                    if modifier_type == 'fixed':
                        p.price_buy = val
                    elif modifier_type == 'percent':
                        p.price_buy = float(p.price_buy) * (1 + val / 100)
                    elif modifier_type == 'value':
                        p.price_buy = float(p.price_buy) + val
                    elif modifier_type == 'formula':
                        p.price_buy = float(p.price_sell) * (1 - val / 100)
                    p.price_buy = round(p.price_buy, decimals)
                    # Recalculate profit margin
                    p.profit_margin = (((float(p.price_sell) - float(p.price_buy)) / float(p.price_buy)) * 100) if float(p.price_buy) > 0 else 0
                    
                elif action_type == 'price_sell':
                    val = float(value or 0)
                    if modifier_type == 'fixed':
                        p.price_sell = val
                    elif modifier_type == 'percent':
                        p.price_sell = float(p.price_sell) * (1 + val / 100)
                    elif modifier_type == 'value':
                        p.price_sell = float(p.price_sell) + val
                    elif modifier_type == 'formula':
                        p.price_sell = float(p.price_buy) * (1 + val / 100)
                    p.price_sell = round(p.price_sell, decimals)
                    # Recalculate profit margin
                    p.profit_margin = (((float(p.price_sell) - float(p.price_buy)) / float(p.price_buy)) * 100) if float(p.price_buy) > 0 else 0
                    
                elif action_type == 'is_active':
                    p.is_active = bool(value)
                    
                elif action_type == 'min_stock':
                    val = float(value or 0)
                    if modifier_type == 'fixed':
                        p.min_stock = val
                    elif modifier_type == 'value':
                        p.min_stock = float(p.min_stock) + val
                        
                elif action_type == 'max_stock':
                    val = float(value or 0)
                    if modifier_type == 'fixed':
                        p.max_stock = val
                    elif modifier_type == 'value':
                        p.max_stock = float(p.max_stock) + val
                        
                elif action_type == 'category':
                    p.category_id = int(value) if value else None
                    
                elif action_type == 'provider':
                    p.provider_id = int(value) if value else None
                    
                p.save()
                count += 1
            except Exception as e:
                print("Error updating product in bulk:", e)
                
        return Response({'success': True, 'message': f'Se actualizaron {count} productos correctamente.'})

    @action(detail=False, methods=['post'], url_path='generate-barcodes')
    def generate_barcodes(self, request):
        product_ids = request.data.get('product_ids', [])
        prefix = request.data.get('prefix', 'GH')
        
        if product_ids:
            products = Product.objects.filter(id__in=product_ids).filter(models.Q(barcode__isnull=True) | models.Q(barcode=''))
        else:
            products = Product.objects.filter(models.Q(barcode__isnull=True) | models.Q(barcode=''))
            
        count = 0
        for p in products:
            p.barcode = f"{prefix}{str(p.id).zfill(8)}"
            p.save()
            count += 1
            
        return Response({'success': True, 'message': f'Se generaron códigos de barra para {count} productos.'})

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        products = Product.objects.filter(
            is_active=True,
            has_inventory_control=True
        ).filter(
            models.Q(stock__lte=models.F('min_stock')) | models.Q(stock__lte=5)
        )
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)



class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]

class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product', 'warehouse']

class KardexViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Kardex.objects.all().order_by('-date')
    serializer_class = KardexSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['product', 'warehouse', 'movement_type']

from django.shortcuts import render
from apps.users.models import SystemSetting

def catalog_view(request):
    """
    Public view that renders the Digital Catalog HTML template
    """
    products = Product.objects.filter(is_active=True)
    categories = Category.objects.all()
    
    # Get settings for store logo/name
    settings = {s.key: s.value for s in SystemSetting.objects.all()}
    store_name = settings.get('store_name', 'Mi Tienda')
    store_logo = settings.get('company_logo', '')
    currency_code = settings.get('currency_code', 'COP')
    currency_symbol = settings.get('currency_symbol', '$')
    
    context = {
        'products': products,
        'categories': categories,
        'store_name': store_name,
        'store_logo': store_logo,
        'currency_code': currency_code,
        'currency_symbol': currency_symbol,
    }
    return render(request, 'inventory/catalog.html', context)
