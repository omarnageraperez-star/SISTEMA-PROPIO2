from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from .models import Table, CatalogOrder, CatalogOrderItem, CustomerUser
from .serializers import (
    TableSerializer, 
    CatalogOrderSerializer, 
    CreateCatalogOrderSerializer,
    UpdateCatalogOrderStatusSerializer,
    CustomerRegisterSerializer,
    CustomerLoginSerializer,
    CustomerProfileSerializer
)
from apps.inventory.models import Product
from apps.users.models import SystemSetting

class CustomerUserBackend(ModelBackend):
    """Backend de autenticación personalizado para CustomerUser"""
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            # Primero intentar con CustomerUser
            user = CustomerUser.objects.get(username=username)
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        except CustomerUser.DoesNotExist:
            # Si no existe en CustomerUser, intentar con el User por defecto
            pass
        return super().authenticate(request, username=username, password=password, **kwargs)

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
    queryset = CatalogOrder.objects.select_related('table', 'processed_by', 'related_sale', 'customer_user', 'assigned_driver').prefetch_related('items', 'items__product')
    serializer_class = CatalogOrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Optimizar queryset con select_related y prefetch_related"""
        queryset = super().get_queryset()
        
        # Si el usuario es un CustomerUser, mostrar solo sus pedidos
        if isinstance(self.request.user, CustomerUser):
            queryset = queryset.filter(customer_user=self.request.user)
        
        # Filtrar por parámetro customer_user si se proporciona (para dashboard de clientes)
        customer_user_id = self.request.query_params.get('customer_user')
        if customer_user_id:
            queryset = queryset.filter(customer_user_id=customer_user_id)
        
        return queryset
    
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
        try:
            order = self.get_object()
            serializer = self.get_serializer(order, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            
            new_status = serializer.validated_data.get('status')
            old_status = order.status
            
            # Actualizar tiempos según estado
            if new_status == 'CONFIRMED' and old_status == 'PENDING':
                from django.utils import timezone
                order.confirmed_at = timezone.now()
            elif new_status == 'DELIVERED' and old_status != 'DELIVERED':
                from django.utils import timezone
                order.delivered_at = timezone.now()
            
            # Si se cancela el pedido y se provee un motivo
            cancel_reason = request.data.get('cancel_reason')
            if new_status == 'CANCELLED' and old_status != 'CANCELLED' and cancel_reason:
                old_notes = order.notes or ''
                prefix = '\n' if old_notes else ''
                order.notes = f"{old_notes}{prefix}CANCELADO: {cancel_reason}"

            # Evidencia de entrega (Base64 desde el frontend)
            if request.data.get('delivery_photo'):
                order.delivery_photo = request.data.get('delivery_photo')
            
            # Si se confirma el pedido, convertir a venta (el SaleSerializer maneja el stock)
            if new_status == 'CONFIRMED' and old_status == 'PENDING':
                # Autoconvertir a Venta POS si no tiene
                if not order.related_sale:
                    try:
                        self._auto_convert_to_sale(order, request.user)
                    except Exception as e:
                        import traceback
                        print(f"Error al convertir pedido a venta: {e}")
                        traceback.print_exc()
                        pass # Evitar romper el flujo si falla la venta automática
                else:
                    print(f"Pedido {order.order_number} ya tiene venta relacionada: {order.related_sale.id}")
            
            serializer.save()
            order.save()
            
            # WhatsApp Notification
            if new_status != old_status:
                try:
                    self._send_whatsapp_notification(order, new_status)
                except Exception as e:
                    pass # Non-blocking
                    
            return Response(CatalogOrderSerializer(order).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _send_whatsapp_notification(self, order, status):
        """Simula o envía notificación por WhatsApp al cliente usando un webhook configurado en sistema"""
        if not order.customer_phone:
            return
            
        import requests
        from apps.users.models import SystemSetting
        
        webhook_setting = SystemSetting.objects.filter(key='whatsapp_webhook_url').first()
        if not webhook_setting or not webhook_setting.value:
            return
            
        status_msgs = {
            'CONFIRMED': f"¡Hola {order.customer_name}! Tu pedido #{order.order_number} ha sido CONFIRMADO. Lo estamos preparando.",
            'PREPARING': f"¡Hola {order.customer_name}! Tu pedido #{order.order_number} ya está en preparación de su pedido.",
            'READY': f"¡Tu pedido #{order.order_number} está LISTO! {'El domiciliario va en camino' if order.order_type == 'DELIVERY' else 'Ya puedes pasar a recogerlo'}.",
            'DELIVERED': f"¡Tu pedido #{order.order_number} ha sido ENTREGADO! Esperamos lo disfrutes.",
            'CANCELLED': f"Hola {order.customer_name}, lamentablemente tu pedido #{order.order_number} ha sido CANCELADO. Motivo: {order.notes}"
        }
        
        msg = status_msgs.get(status)
        if not msg:
            return
            
        payload = {
            "phone": order.customer_phone,
            "message": msg,
            "order_number": order.order_number,
            "status": status
        }
        
        try:
            # Hacemos la peticion al webhook externo de WhatsApp (ej. Twilio, Meta API, Make.com)
            requests.post(webhook_setting.value, json=payload, timeout=2)
        except:
            pass
    
    def _auto_convert_to_sale(self, order, user):
        """
        Crea una Venta completa igual que si el cajero la hubiera generado desde el POS.
        Usa el SaleSerializer para garantizar: número de factura, Kardex, turno de caja, etc.
        """
        # Verificar que el pedido no tenga ya una venta relacionada (recargar desde DB para estar seguro)
        order = CatalogOrder.objects.get(pk=order.pk)
        if order.related_sale:
            print(f"Pedido {order.order_number} ya tiene venta relacionada {order.related_sale.id}, no se creará otra")
            return order.related_sale

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
        
        print(f"Creada venta {sale.id} para pedido {order.order_number}")
        
        # 8. Vincular la venta al pedido
        order.related_sale = sale
        order.processed_by = user
        order.save(update_fields=['related_sale', 'processed_by'])
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
    
    @action(detail=True, methods=['post'], url_path='submit-rating', permission_classes=[AllowAny])
    def submit_rating(self, request, pk=None):
        """Endpoint público para calificar un pedido entregado"""
        try:
            order = self.get_object()
            
            if order.status != 'DELIVERED':
                return Response({'error': 'Solo se pueden calificar pedidos entregados'}, status=status.HTTP_400_BAD_REQUEST)
                
            rating = request.data.get('rating')
            feedback = request.data.get('customer_feedback', '')
            
            if not rating or not str(rating).isdigit() or int(rating) < 1 or int(rating) > 5:
                return Response({'error': 'La calificación debe ser un número del 1 al 5'}, status=status.HTTP_400_BAD_REQUEST)
                
            order.rating = int(rating)
            order.customer_feedback = feedback
            order.save(update_fields=['rating', 'customer_feedback'])
            
            return Response({'message': 'Calificación enviada con éxito'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            'order_type': order.order_type,
            'customer_name': order.customer_name,
            'customer_address': order.customer_address or '',
            'total': order.total,
            'created_at': order.created_at,
            'confirmed_at': order.confirmed_at,
            'delivered_at': order.delivered_at,
            'notes': order.notes or '',
            'driver_lat': order.driver_lat,
            'driver_lng': order.driver_lng,
            'last_location_update': order.last_location_update,
        })

    @action(detail=False, methods=['post'], url_path='update-location')
    def update_location(self, request):
        """Endpoint para que el domiciliario envíe su ubicación GPS en tiempo real"""
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        
        if lat is None or lng is None:
            return Response({'error': 'lat y lng son requeridos'}, status=400)
        
        # Actualizar todas las órdenes READY asignadas a este domiciliario
        active_orders = CatalogOrder.objects.filter(
            status='READY',
            order_type='DELIVERY',
            assigned_driver=request.user
        )
        
        updated = active_orders.update(
            driver_lat=float(lat),
            driver_lng=float(lng),
            last_location_update=timezone.now()
        )
        
        return Response({'updated_orders': updated})
    
    @action(detail=True, methods=['post'], url_path='assign-driver')
    def assign_driver(self, request, pk=None):
        """Asignar un domiciliario a un pedido (desde POS)"""
        order = self.get_object()
        driver_id = request.data.get('driver_id')
        
        if not driver_id:
            return Response({'error': 'driver_id es requerido'}, status=400)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            driver = User.objects.get(id=driver_id)
        except User.DoesNotExist:
            return Response({'error': 'Domiciliario no encontrado'}, status=404)
        
        order.assigned_driver = driver
        order.save(update_fields=['assigned_driver'])
        
        return Response(CatalogOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'], url_path='accept-route')
    def accept_route(self, request, pk=None):
        """Domiciliario acepta la ruta (desde APK)"""
        order = self.get_object()
        
        if order.assigned_driver != request.user:
            return Response({'error': 'Este pedido no está asignado a ti'}, status=403)
        
        if order.route_accepted_at:
            return Response({'error': 'La ruta ya fue aceptada'}, status=400)
        
        from django.utils import timezone
        order.route_accepted_at = timezone.now()
        order.save(update_fields=['route_accepted_at'])
        
        return Response({'message': 'Ruta aceptada correctamente'})
    
    @action(detail=True, methods=['post'], url_path='start-route')
    def start_route(self, request, pk=None):
        """Domiciliario inicia la ruta (desde APK)"""
        order = self.get_object()
        
        if order.assigned_driver != request.user:
            return Response({'error': 'Este pedido no está asignado a ti'}, status=403)
        
        if not order.route_accepted_at:
            return Response({'error': 'Debes aceptar la ruta primero'}, status=400)
        
        if order.route_started_at:
            return Response({'error': 'La ruta ya fue iniciada'}, status=400)
        
        from django.utils import timezone
        order.route_started_at = timezone.now()
        order.save(update_fields=['route_started_at'])
        
        return Response({'message': 'Ruta iniciada correctamente'})
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Listar pedidos pendientes"""
        pending_orders = self.queryset.filter(status='PENDING').select_related('table', 'processed_by', 'related_sale').prefetch_related('items', 'items__product')
        serializer = self.get_serializer(pending_orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Listar pedidos activos (no entregados ni cancelados)"""
        active_orders = self.queryset.exclude(status__in=['DELIVERED', 'CANCELLED']).select_related('table', 'processed_by', 'related_sale').prefetch_related('items', 'items__product')
        serializer = self.get_serializer(active_orders, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='available-drivers')
    def available_drivers(self, request):
        """Listar usuarios con rol DELIVERY disponibles"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        drivers = User.objects.filter(role='DELIVERY', is_active=True).values('id', 'username', 'first_name', 'last_name')
        return Response(list(drivers))
    
    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        """Listar pedidos asignados al domiciliario actual (desde APK)"""
        orders = self.queryset.filter(
            assigned_driver=request.user,
            status__in=['READY', 'DELIVERED']
        ).select_related('table', 'processed_by', 'related_sale', 'customer_user', 'assigned_driver').prefetch_related('items', 'items__product')
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def history(self, request):
        """Endpoint público para consultar el historial de pedidos por número de teléfono"""
        phone = request.query_params.get('phone')
        if not phone:
            return Response({'error': 'Número de teléfono requerido'}, status=400)
            
        # Buscar todos los pedidos asociados a este teléfono
        orders = self.queryset.filter(customer_phone=phone).order_by('-created_at')
        
        if not orders.exists():
            return Response({'error': 'No se encontraron pedidos con este número'}, status=404)
            
        return Response(CatalogOrderSerializer(orders, many=True).data)
    
    from django.views.decorators.cache import never_cache
    from django.utils.decorators import method_decorator

    @method_decorator(never_cache)
    @action(detail=False, methods=['get'], url_path='check-new-orders')
    def check_new_orders(self, request):
        """Verificar si hay nuevos pedidos (para notificaciones en tiempo real)"""
        from apps.users.models import SystemSetting
        from django.core.cache import cache
        
        # Usar cache para contar pedidos pendientes (más rápido)
        pending_count_cache_key = 'pending_catalog_orders_count'
        pending_count = cache.get(pending_count_cache_key)
        if pending_count is None:
            pending_count = self.queryset.filter(status='PENDING').count()
            cache.set(pending_count_cache_key, pending_count, timeout=30)  # Cache por 30 segundos
        
        # Si el usuario es domiciliario, verificar si tiene nuevos pedidos asignados
        if hasattr(request.user, 'role') and request.user.role == 'DELIVERY':
            driver_orders_cache_key = f'driver_orders_{request.user.id}'
            last_driver_order_id = cache.get(driver_orders_cache_key)
            
            # Obtener el último pedido asignado a este domiciliario
            recent_driver_order = self.queryset.filter(
                assigned_driver=request.user,
                status__in=['READY', 'DELIVERED']
            ).select_related('table', 'processed_by', 'assigned_driver').prefetch_related('items', 'items__product').order_by('-id').first()
            
            if recent_driver_order:
                if last_driver_order_id is None or recent_driver_order.id > last_driver_order_id:
                    # Actualizar cache
                    cache.set(driver_orders_cache_key, recent_driver_order.id, timeout=300)
                    
                    serializer = self.get_serializer(recent_driver_order)
                    return Response({
                        'has_new': True,
                        'order': serializer.data,
                        'pending_count': pending_count,
                        'is_driver_order': True
                    })
        
        # Para usuarios no domiciliarios, verificar pedidos pendientes
        recent_order = self.queryset.filter(status='PENDING').select_related('table', 'processed_by').prefetch_related('items', 'items__product').order_by('-id').first()
        
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
                    'pending_count': pending_count,
                    'is_driver_order': False
                })
            
        return Response({
            'has_new': False,
            'pending_count': pending_count
        })

# Vistas de Django para páginas de autenticación de clientes
@require_http_methods(["GET", "POST"])
def customer_login_view(request):
    """Página de login para clientes"""
    from django.core.cache import cache
    settings_cache_key = 'catalog_settings'
    settings = cache.get(settings_cache_key)
    if settings is None:
        settings = {s.key: s.value for s in SystemSetting.objects.all().only('key', 'value')}
        cache.set(settings_cache_key, settings, timeout=300)
    
    store_name = settings.get('store_name', 'Mi Tienda')
    store_logo = settings.get('company_logo', '')
    
    context = {
        'store_name': store_name,
        'store_logo': store_logo
    }
    return render(request, 'catalog_orders/customer_login.html', context)

@require_http_methods(["GET", "POST"])
def customer_register_view(request):
    """Página de registro para clientes"""
    from django.core.cache import cache
    settings_cache_key = 'catalog_settings'
    settings = cache.get(settings_cache_key)
    if settings is None:
        settings = {s.key: s.value for s in SystemSetting.objects.all().only('key', 'value')}
        cache.set(settings_cache_key, settings, timeout=300)
    
    store_name = settings.get('store_name', 'Mi Tienda')
    store_logo = settings.get('company_logo', '')
    
    context = {
        'store_name': store_name,
        'store_logo': store_logo
    }
    return render(request, 'catalog_orders/customer_register.html', context)

def customer_dashboard_view(request):
    """Dashboard del cliente autenticado"""
    if not request.user.is_authenticated or not isinstance(request.user, CustomerUser):
        from django.shortcuts import redirect
        return redirect('/catalogo/login/')
    
    # Obtener pedidos del cliente
    orders = CatalogOrder.objects.filter(customer_user=request.user).order_by('-created_at')[:10]
    
    from django.core.cache import cache
    settings_cache_key = 'catalog_settings'
    settings = cache.get(settings_cache_key)
    if settings is None:
        settings = {s.key: s.value for s in SystemSetting.objects.all().only('key', 'value')}
        cache.set(settings_cache_key, settings, timeout=300)
    
    store_name = settings.get('store_name', 'Mi Tienda')
    store_logo = settings.get('company_logo', '')
    
    context = {
        'store_name': store_name,
        'store_logo': store_logo,
        'orders': orders,
        'customer': request.user
    }
    return render(request, 'catalog_orders/customer_dashboard.html', context)

def customer_logout_view(request):
    """Logout de cliente"""
    from django.contrib.auth import logout
    logout(request)
    from django.shortcuts import redirect
    return redirect('/catalogo/login/')

class CustomerAuthViewSet(viewsets.ViewSet):
    """ViewSet para autenticación de clientes"""
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'], url_path='register')
    def register(self, request):
        """Registrar nuevo cliente"""
        serializer = CustomerRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Auto login después del registro
            login(request, user)
            return Response({
                'message': 'Registro exitoso',
                'user': CustomerProfileSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request):
        """Login de cliente"""
        serializer = CustomerLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            login(request, user)
            return Response({
                'message': 'Login exitoso',
                'user': CustomerProfileSerializer(user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='profile')
    def profile(self, request):
        """Obtener perfil del cliente autenticado"""
        if not request.user.is_authenticated or not isinstance(request.user, CustomerUser):
            return Response(
                {'error': 'No autenticado'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = CustomerProfileSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put'], url_path='profile')
    def update_profile(self, request):
        """Actualizar perfil del cliente autenticado"""
        if not request.user.is_authenticated or not isinstance(request.user, CustomerUser):
            return Response(
                {'error': 'No autenticado'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = CustomerProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        """Obtener pedidos del cliente autenticado"""
        if not request.user.is_authenticated or not isinstance(request.user, CustomerUser):
            return Response(
                {'error': 'No autenticado'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        orders = CatalogOrder.objects.filter(customer_user=request.user).order_by('-created_at')
        serializer = CatalogOrderSerializer(orders, many=True)
        return Response(serializer.data)
