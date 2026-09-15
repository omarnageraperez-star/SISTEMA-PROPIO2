from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone
from .models import Table, CatalogOrder, CatalogOrderItem
from .serializers import (
    TableSerializer, 
    CatalogOrderSerializer, 
    CreateCatalogOrderSerializer,
    UpdateCatalogOrderStatusSerializer
)
from apps.inventory.models import Product

class TableViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar mesas"""
    queryset = Table.objects.filter(is_active=True)
    serializer_class = TableSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action == 'by_qr':
            return [AllowAny()]
        return super().get_permissions()
    
    @action(detail=False, methods=['get'], url_path='by-qr/(?P<qr_code>[^/.]+)')
    def by_qr(self, request, qr_code=None):
        """Obtener mesa por código QR (público para catálogo)"""
        try:
            table = Table.objects.get(qr_code=qr_code, is_active=True)
            serializer = self.get_serializer(table)
            return Response(serializer.data)
        except Table.DoesNotExist:
            return Response(
                {'error': 'Mesa no encontrada o inactiva'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class CatalogOrderViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar pedidos del catálogo"""
    queryset = CatalogOrder.objects.select_related('table', 'processed_by').prefetch_related('items')
    serializer_class = CatalogOrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]  # Público para el catálogo web
        return super().get_permissions()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateCatalogOrderSerializer
        elif self.action == 'update_status':
            return UpdateCatalogOrderStatusSerializer
        return super().get_serializer_class()
    
    def create(self, request, *args, **kwargs):
        """Crear un nuevo pedido desde el catálogo web"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Validar stock antes de crear el pedido
        items_data = serializer.validated_data.get('items', [])
        for item in items_data:
            product = item.get('product')
            quantity = item.get('quantity')
            
            if product and product.has_inventory_control:
                if product.stock < quantity:
                    return Response(
                        {'error': f'Producto {product.name} no tiene suficiente stock. Disponible: {product.stock}, Solicitado: {quantity}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            CatalogOrderSerializer(serializer.instance).data, 
            status=status.HTTP_201_CREATED, 
            headers=headers
        )
    
    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        """Actualizar estado de un pedido"""
        order = self.get_object()
        serializer = self.get_serializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        new_status = serializer.validated_data.get('status')
        old_status = order.status
        
        # Actualizar tiempos según estado
        if new_status == 'CONFIRMED' and old_status == 'PENDING':
            order.confirmed_at = timezone.now()
        elif new_status == 'DELIVERED' and old_status != 'DELIVERED':
            order.delivered_at = timezone.now()
        
        # Si se confirma el pedido, descontar inventario
        if new_status == 'CONFIRMED' and old_status == 'PENDING':
            for item in order.items.all():
                if item.product and item.product.has_inventory_control:
                    item.product.stock -= item.quantity
                    item.product.save()
        
        serializer.save()
        return Response(CatalogOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'], url_path='convert-to-sale')
    def convert_to_sale(self, request, pk=None):
        """Convertir pedido del catálogo a venta del sistema POS"""
        order = self.get_object()
        
        if order.related_sale:
            return Response(
                {'error': 'Este pedido ya está asociado a una venta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Crear venta desde el pedido
        from apps.sales.models import Sale, SaleItem
        from apps.crm.models import Customer
        
        # Crear o buscar cliente
        customer, created = Customer.objects.get_or_create(
            name=order.customer_name,
            defaults={
                'phone': order.customer_phone or '',
                'address': order.customer_address or ''
            }
        )
        
        # Crear venta
        sale = Sale.objects.create(
            user=request.user,
            customer=customer,
            status='COMPLETED',
            subtotal=order.subtotal,
            tax=order.tax,
            total=order.total,
            payment_method=order.payment_method
        )
        
        # Crear items de venta
        for order_item in order.items.all():
            SaleItem.objects.create(
                sale=sale,
                product=order_item.product,
                product_name=order_item.product_name,
                quantity=order_item.quantity,
                unit_price=order_item.unit_price,
                subtotal=order_item.subtotal
            )
        
        # Asociar venta al pedido
        order.related_sale = sale
        order.processed_by = request.user
        order.status = 'DELIVERED'
        order.delivered_at = timezone.now()
        order.save()
        
        return Response(CatalogOrderSerializer(order).data)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Listar pedidos pendientes"""
        pending_orders = self.queryset.filter(status='PENDING')
        serializer = self.get_serializer(pending_orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Listar pedidos activos (no entregados ni cancelados)"""
        active_orders = self.queryset.exclude(status__in=['DELIVERED', 'CANCELLED'])
        serializer = self.get_serializer(active_orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def check_new_orders(self, request):
        """Verificar si hay nuevos pedidos (para notificaciones en tiempo real)"""
        from django.core.cache import cache
        
        new_order = cache.get('new_catalog_order')
        pending_count = cache.get('pending_catalog_orders_count', 0)
        
        if new_order:
            # Limpiar la cache después de leer
            cache.delete('new_catalog_order')
            return Response({
                'has_new': True,
                'order': new_order,
                'pending_count': pending_count
            })
        
        return Response({
            'has_new': False,
            'pending_count': pending_count
        })
