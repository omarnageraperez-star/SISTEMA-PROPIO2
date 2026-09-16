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
        try:
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
            
            # --- START FIX: Set cache for real-time notification ---
            from django.core.cache import cache
            cache.set('new_catalog_order', CatalogOrderSerializer(serializer.instance).data, timeout=60)
            pending_count = CatalogOrder.objects.filter(status='PENDING').count()
            cache.set('pending_catalog_orders_count', pending_count, timeout=60*60)
            # --- END FIX ---
            
            headers = self.get_success_headers(serializer.data)
            return Response(
                CatalogOrderSerializer(serializer.instance).data, 
                status=status.HTTP_201_CREATED, 
                headers=headers
            )
        except Exception as e:
            return Response(
                {'error': f'Error al crear pedido: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        
        # Si el pedido se cancela y se provee un motivo
        cancel_reason = request.data.get('cancel_reason')
        if new_status == 'CANCELLED' and old_status != 'CANCELLED' and cancel_reason:
            old_notes = order.notes or ''
            prefix = '\n' if old_notes else ''
            order.notes = f"{old_notes}{prefix}CANCELADO: {cancel_reason}"
        
        # Si se confirma el pedido, descontar inventario y convertir a venta
        if new_status == 'CONFIRMED' and old_status == 'PENDING':
            for item in order.items.all():
                if item.product and item.product.has_inventory_control:
                    item.product.stock -= item.quantity
                    item.product.save()
            
            # Autoconvertir a Venta POS si no tiene
            if not order.related_sale:
                try:
                    self._auto_convert_to_sale(order, request.user)
                except Exception as e:
                    pass # Evitar romper el flujo si falla la venta automática
        
        serializer.save()
        return Response(CatalogOrderSerializer(order).data)
    
    def _auto_convert_to_sale(self, order, user):
        """
        Crea una Venta completa igual que si el cajero la hubiera generado desde el POS.
        Usa el SaleSerializer para garantizar: número de factura, Kardex, turno de caja, etc.
        """
        from apps.sales.serializers import SaleSerializer
        from apps.inventory.models import Warehouse
        from apps.crm.models import Customer

        # 1. Obtener o crear el cliente en CRM con nombre y apellido separados
        full_name = order.customer_name.strip()
        parts = full_name.split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else 'Web'
        
        customer = Customer.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name
        ).first()
        if not customer:
            customer = Customer.objects.create(
                first_name=first_name,
                last_name=last_name,
                phone=order.customer_phone or '',
                address=order.customer_address or '',
            )
        
        # 2. Obtener el almacén principal
        warehouse = Warehouse.objects.first()
        
        # 3. Construir el payload de items para el serializer
        details_data = []
        for order_item in order.items.all():
            if order_item.product:
                details_data.append({
                    'product': order_item.product.id,
                    'quantity': str(order_item.quantity),
                    'unit_price': str(order_item.unit_price),
                    'discount': '0',
                })
        
        # 4. Construir el método de pago a partir del pedido
        payment_name = dict(order.PAYMENT_METHOD_CHOICES).get(order.payment_method, 'Efectivo')
        from apps.sales.models import PaymentMethod as PM
        pm_obj, _ = PM.objects.get_or_create(name=payment_name, defaults={'is_active': True})
        
        payments_data = [{
            'payment_method': pm_obj.id,
            'amount': str(order.total),
        }]
        
        # 5. Payload completo para el serializer (idéntico al del POS)
        sale_data = {
            'warehouse': warehouse.id if warehouse else None,
            'customer': customer.id,
            'status': 'COMPLETED',
            'invoice_type': 'POS',
            'details': details_data,
            'payments': payments_data,
        }
        
        # 6. Crear mock request con el usuario para que el serializer lo tome
        from rest_framework.request import Request as DRFRequest
        from django.test import RequestFactory
        factory = RequestFactory()
        mock_request = factory.post('/')
        mock_request.user = user
        
        # 7. Ejecutar el serializer con la lógica completa del POS
        serializer = SaleSerializer(data=sale_data, context={'request': mock_request})
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        
        # 8. Vincular la venta al pedido
        order.related_sale = sale
        order.processed_by = user
        order.save()
        return sale


    @action(detail=True, methods=['post'], url_path='convert-to-sale')
    def convert_to_sale(self, request, pk=None):
        """Convertir pedido del catálogo a venta del sistema POS manualmente"""
        order = self.get_object()
        
        if order.related_sale:
            return Response(
                {'error': 'Este pedido ya está asociado a una venta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self._auto_convert_to_sale(order, request.user)
        # Update status to delivered if converted manually
        order.status = 'DELIVERED'
        order.delivered_at = timezone.now()
        order.save()
        
        return Response(CatalogOrderSerializer(order).data)
    
    @action(detail=False, methods=['get'], permission_classes=[])
    def track(self, request):
        """Endpoint público para consultar estado del pedido sin auth"""
        order_number = request.query_params.get('order_number')
        if not order_number:
            return Response({'error': 'Número de pedido requerido'}, status=400)
            
        order = self.queryset.filter(order_number=order_number).first()
        if not order:
            return Response({'error': 'Pedido no encontrado'}, status=404)
            
        return Response({
            'order_number': order.order_number,
            'status': order.status,
            'customer_name': order.customer_name,
            'total': order.total,
            'created_at': order.created_at,
            'notes': order.notes or '',
        })
    
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
    
    from django.views.decorators.cache import never_cache
    from django.utils.decorators import method_decorator

    @method_decorator(never_cache)
    @action(detail=False, methods=['get'], url_path='check-new-orders')
    def check_new_orders(self, request):
        """Verificar si hay nuevos pedidos (para notificaciones en tiempo real)"""
        from apps.users.models import SystemSetting
        
        # Obtener el último pedido pendiente
        recent_order = self.queryset.filter(status='PENDING').order_by('-id').first()
        pending_count = self.queryset.filter(status='PENDING').count()
        
        if recent_order:
            # Obtener el ID del último pedido notificado desde la DB
            last_notified_setting, _ = SystemSetting.objects.get_or_create(
                key='last_notified_order_id',
                defaults={'value': '0'}
            )
            
            last_notified_id = int(last_notified_setting.value)
            
            # Si el pedido actual es más nuevo que el último notificado
            if recent_order.id > last_notified_id:
                # Actualizar el setting para no notificar de nuevo
                last_notified_setting.value = str(recent_order.id)
                last_notified_setting.save()
                
                serializer = self.get_serializer(recent_order)
                return Response({
                    'has_new': True,
                    'order': serializer.data,
                    'pending_count': pending_count
                })
            
        return Response({
            'has_new': False,
            'pending_count': pending_count
        })
