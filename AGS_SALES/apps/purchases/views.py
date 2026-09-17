from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg, Min, Max, Count, Sum, F
from django.db.models.functions import TruncDate
from .models import Provider, PurchaseOrder, PurchaseOrderDetail
from .serializers import (
    ProviderSerializer, PurchaseOrderSerializer, PurchaseOrderDetailSerializer,
    PriceHistorySerializer, PriceComparisonSerializer, PriceTrendSerializer, PurchaseAnalyticsSerializer
)

class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['name', 'contact_name', 'email', 'tax_id']
    filterset_fields = ['is_active']

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().select_related('provider').prefetch_related(
        'details', 'details__product'
    )
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'provider']

class PurchaseOrderDetailViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrderDetail.objects.all().select_related('product', 'order')
    serializer_class = PurchaseOrderDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['order', 'product']

    @action(detail=False, methods=['get'])
    def price_history(self, request):
        """Historial de precios de un producto por proveedor"""
        product_id = request.query_params.get('product_id')
        provider_id = request.query_params.get('provider_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not product_id:
            return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        queryset = PurchaseOrderDetail.objects.filter(product_id=product_id)
        
        if provider_id:
            queryset = queryset.filter(order__provider_id=provider_id)
        if start_date:
            queryset = queryset.filter(order__order_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(order__order_date__lte=end_date)
        
        queryset = queryset.select_related('order__provider').order_by('order__order_date')
        
        data = [
            {
                'date': detail.order.order_date,
                'provider': detail.order.provider.name,
                'provider_id': detail.order.provider.id,
                'unit_price': detail.unit_price,
                'quantity': detail.quantity,
                'total_price': detail.total_price
            }
            for detail in queryset
        ]
        
        serializer = PriceHistorySerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def price_comparison(self, request):
        """Comparación de precios entre proveedores para un producto"""
        product_id = request.query_params.get('product_id')
        
        if not product_id:
            return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        comparison = PurchaseOrderDetail.objects.filter(product_id=product_id).values(
            'order__provider__name',
            'order__provider__id'
        ).annotate(
            avg_price=Avg('unit_price'),
            min_price=Min('unit_price'),
            max_price=Max('unit_price'),
            purchase_count=Count('id')
        ).order_by('avg_price')
        
        data = [
            {
                'provider': item['order__provider__name'],
                'provider_id': item['order__provider__id'],
                'avg_price': item['avg_price'],
                'min_price': item['min_price'],
                'max_price': item['max_price'],
                'purchase_count': item['purchase_count']
            }
            for item in comparison
        ]
        
        serializer = PriceComparisonSerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def price_trends(self, request):
        """Tendencia de precios en el tiempo"""
        product_id = request.query_params.get('product_id')
        provider_id = request.query_params.get('provider_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not product_id:
            return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        queryset = PurchaseOrderDetail.objects.filter(product_id=product_id)
        
        if provider_id:
            queryset = queryset.filter(order__provider_id=provider_id)
        if start_date:
            queryset = queryset.filter(order__order_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(order__order_date__lte=end_date)
        
        queryset = queryset.annotate(
            date=TruncDate('order__order_date')
        ).values('date', 'order__provider__name').annotate(
            price=Avg('unit_price')
        ).order_by('date')
        
        # Calculate variation percent
        data = []
        prev_price = None
        for item in queryset:
            variation = None
            if prev_price is not None and prev_price > 0:
                variation = ((item['price'] - prev_price) / prev_price) * 100
            
            data.append({
                'date': item['date'],
                'price': item['price'],
                'variation_percent': variation,
                'provider': item['order__provider__name']
            })
            prev_price = item['price']
        
        serializer = PriceTrendSerializer(data, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Dashboard completo con métricas agregadas"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        provider_id = request.query_params.get('provider_id')
        
        queryset = PurchaseOrder.objects.filter(status='RECEIVED')
        
        if start_date:
            queryset = queryset.filter(order_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(order_date__lte=end_date)
        if provider_id:
            queryset = queryset.filter(provider_id=provider_id)
        
        # Total spent
        total_spent = queryset.aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Total orders
        total_orders = queryset.count()
        
        # Top provider
        top_provider_data = queryset.values('provider__name').annotate(
            count=Count('id')
        ).order_by('-count').first()
        top_provider = top_provider_data['provider__name'] if top_provider_data else None
        
        # Top product
        top_product_data = PurchaseOrderDetail.objects.filter(
            order__in=queryset
        ).values('product__name').annotate(
            count=Count('id')
        ).order_by('-count').first()
        top_product = top_product_data['product__name'] if top_product_data else None
        
        # Average order value
        avg_order_value = total_spent / total_orders if total_orders > 0 else 0
        
        # Products with price variation
        price_variation_products = PurchaseOrderDetail.objects.filter(
            order__in=queryset
        ).values('product').annotate(
            min_price=Min('unit_price'),
            max_price=Max('unit_price')
        ).filter(max_price__gt=F('min_price')).count()
        
        data = {
            'total_spent': total_spent,
            'total_orders': total_orders,
            'top_provider': top_provider,
            'top_product': top_product,
            'avg_order_value': avg_order_value,
            'price_variation_products': price_variation_products
        }
        
        serializer = PurchaseAnalyticsSerializer(data)
        return Response(serializer.data)
