from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from apps.inventory.models import Product, Warehouse
from .models import (
    QuotationConfiguration, Quotation, QuotationItem, ExtraTemplate,
    StockReservation, QuotationAuditLog
)
from .serializers import (
    QuotationConfigurationSerializer, ExtraTemplateSerializer,
    QuotationListSerializer, QuotationDetailSerializer,
    QuotationCreateUpdateSerializer, StockReservationSerializer
)
from .services import (
    get_available_stock, create_quotation_revision, duplicate_quotation,
    reserve_stock_for_quotation, release_stock_for_quotation, log_quotation_event
)
from .conversion import validate_quotation_for_conversion, convert_quotation_to_sale


class QuotationConfigurationViewSet(viewsets.ViewSet):
    """
    Gestiona la configuración singleton del módulo de cotizaciones.
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        config = QuotationConfiguration.get_solo()
        serializer = QuotationConfigurationSerializer(config)
        return Response(serializer.data)

    def create(self, request):
        config = QuotationConfiguration.get_solo()
        serializer = QuotationConfigurationSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ExtraTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD de plantillas de adicionales y personalizaciones.
    """
    queryset = ExtraTemplate.objects.all().order_by('-created_at')
    serializer_class = ExtraTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['template_type', 'category', 'product', 'is_active']
    search_fields = ['name']


class QuotationViewSet(viewsets.ModelViewSet):
    """
    ViewSet maestro para la gestión integral de cotizaciones.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Auto-actualizar expiraciones al listar
        now = timezone.now().date()
        Quotation.objects.filter(
            status__in=['DRAFT', 'SENT'],
            valid_until__lt=now
        ).update(status='EXPIRED')

        qs = Quotation.objects.all().select_related(
            'customer', 'user', 'warehouse', 'sale', 'parent_quotation'
        ).prefetch_related(
            'items__product', 'items__extras', 'items__customizations',
            'audit_logs__user', 'stock_reservations'
        ).order_by('-created_at')

        # Filtros opcionales
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        customer_param = self.request.query_params.get('customer')
        if customer_param:
            qs = qs.filter(customer_id=customer_param)

        user_param = self.request.query_params.get('user')
        if user_param:
            qs = qs.filter(user_id=user_param)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(issue_date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(issue_date__lte=date_to)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(consecutive__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(customer_document__icontains=search) |
                Q(customer_email__icontains=search)
            )

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return QuotationListSerializer
        elif self.action in ('create', 'update', 'partial_update'):
            return QuotationCreateUpdateSerializer
        return QuotationDetailSerializer

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Indicadores estadísticos clave (KPIs) para el dashboard de cotizaciones.
        """
        now = timezone.now().date()
        in_3_days = now + timedelta(days=3)

        total_count = Quotation.objects.count()
        total_amount = Quotation.objects.aggregate(total=Sum('total'))['total'] or Decimal('0.00')

        converted_count = Quotation.objects.filter(status='CONVERTED').count()
        converted_amount = Quotation.objects.filter(status='CONVERTED').aggregate(total=Sum('total'))['total'] or Decimal('0.00')

        active_count = Quotation.objects.filter(status__in=['DRAFT', 'SENT', 'APPROVED']).count()
        expiring_soon_count = Quotation.objects.filter(
            status__in=['DRAFT', 'SENT'],
            valid_until__gte=now,
            valid_until__lte=in_3_days
        ).count()

        conversion_rate = 0.0
        if total_count > 0:
            conversion_rate = round((converted_count / total_count) * 100, 1)

        counts_by_status = dict(
            Quotation.objects.values('status').annotate(count=Count('id')).values_list('status', 'count')
        )

        return Response({
            'total_count': total_count,
            'total_amount': float(total_amount),
            'converted_count': converted_count,
            'converted_amount': float(converted_amount),
            'conversion_rate': conversion_rate,
            'active_count': active_count,
            'expiring_soon_count': expiring_soon_count,
            'counts_by_status': counts_by_status
        })

    @action(detail=False, methods=['get'], url_path='check-stock')
    def check_stock(self, request):
        """
        Consulta en tiempo real el stock físico y disponible (descontando reservas activas)
        de un producto en una bodega específica.
        """
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'Debe especificar product_id'}, status=400)

        product = Product.objects.filter(id=product_id).first()
        if not product:
            return Response({'error': 'Producto no encontrado'}, status=404)

        wh_id = request.query_params.get('warehouse_id')
        warehouse = Warehouse.objects.filter(id=wh_id).first() if wh_id else None

        physical = float(product.stock)
        avail = float(get_available_stock(product, warehouse))
        reserved = max(0.0, physical - avail)

        return Response({
            'product_id': product.id,
            'name': product.name,
            'has_inventory_control': product.has_inventory_control,
            'physical_stock': physical,
            'reserved_stock': reserved,
            'available_stock': avail,
            'price_sell': float(product.price_sell),
            'tax_percent': float(product.tax_percent),
            'measurement_unit': product.measurement_unit
        })

    @action(detail=True, methods=['post'], url_path='send')
    def mark_as_sent(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status not in ('DRAFT', 'REJECTED'):
            return Response({'detail': f'Solo se pueden enviar cotizaciones en estado Borrador o Rechazada.'}, status=400)

        quotation.status = 'SENT'
        quotation.save(update_fields=['status', 'updated_at'])
        log_quotation_event(quotation, request.user, 'SEND', f"Cotización {quotation.consecutive} marcada como enviada al cliente.")
        return Response(QuotationDetailSerializer(quotation, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status in ('CONVERTED', 'CANCELLED'):
            return Response({'detail': f'No se puede aprobar una cotización en estado {quotation.get_status_display()}.'}, status=400)

        quotation.status = 'APPROVED'
        quotation.approved_at = timezone.now()
        quotation.approved_by = request.user
        quotation.save(update_fields=['status', 'approved_at', 'approved_by', 'updated_at'])

        log_quotation_event(quotation, request.user, 'APPROVE', f"Cotización {quotation.consecutive} aprobada por {request.user.username}.")

        # Si está configurada la reserva automática de stock, reservarlo
        config = QuotationConfiguration.get_solo()
        if config.enable_stock_reservation:
            try:
                reserve_stock_for_quotation(quotation, user=request.user)
            except Exception as e:
                pass  # Si falta stock pero allow_zero_stock_quotation es True, continúa

        return Response(QuotationDetailSerializer(quotation, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status in ('CONVERTED', 'CANCELLED'):
            return Response({'detail': f'No se puede rechazar una cotización en estado {quotation.get_status_display()}.'}, status=400)

        reason = request.data.get('reason', '')
        quotation.status = 'REJECTED'
        quotation.rejection_reason = reason
        quotation.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        # Liberar reservas si tenía
        release_stock_for_quotation(quotation, user=request.user)

        log_quotation_event(quotation, request.user, 'REJECT', f"Cotización rechazada. Motivo: {reason or 'Sin motivo'}")
        return Response(QuotationDetailSerializer(quotation, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status == 'CONVERTED':
            return Response({'detail': 'No se puede cancelar una cotización ya convertida en venta.'}, status=400)

        quotation.status = 'CANCELLED'
        quotation.save(update_fields=['status', 'updated_at'])
        release_stock_for_quotation(quotation, user=request.user)

        log_quotation_event(quotation, request.user, 'CANCEL', f"Cotización cancelada.")
        return Response(QuotationDetailSerializer(quotation, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        quotation = self.get_object()
        new_q = duplicate_quotation(quotation, request.user)
        return Response(
            QuotationDetailSerializer(new_q, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='create-revision')
    def create_revision(self, request, pk=None):
        quotation = self.get_object()
        new_q = create_quotation_revision(quotation, request.user)
        return Response(
            QuotationDetailSerializer(new_q, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'], url_path='reserve-stock')
    def reserve_stock(self, request, pk=None):
        quotation = self.get_object()
        days = request.data.get('days')
        if days:
            try:
                days = int(days)
            except Exception:
                days = None
        try:
            success, msg = reserve_stock_for_quotation(quotation, days=days, user=request.user)
            if not success:
                return Response({'error': msg}, status=400)
            return Response({
                'message': msg,
                'quotation': QuotationDetailSerializer(quotation, context={'request': request}).data
            })
        except ValueError as ve:
            return Response({'error': str(ve)}, status=400)

    @action(detail=True, methods=['post'], url_path='release-stock')
    def release_stock(self, request, pk=None):
        quotation = self.get_object()
        release_stock_for_quotation(quotation, user=request.user)
        return Response({
            'message': 'Reservas de inventario liberadas exitosamente.',
            'quotation': QuotationDetailSerializer(quotation, context={'request': request}).data
        })

    @action(detail=True, methods=['get'], url_path='validate-conversion')
    def validate_conversion(self, request, pk=None):
        quotation = self.get_object()
        validation = validate_quotation_for_conversion(quotation)
        return Response(validation)

    @action(detail=True, methods=['post'], url_path='convert-to-sale')
    def convert_to_sale_view(self, request, pk=None):
        quotation = self.get_object()
        payment_method_id = request.data.get('payment_method_id')
        amount_received = request.data.get('amount_received')
        line_item_ids = request.data.get('line_item_ids')

        try:
            sale = convert_quotation_to_sale(
                quotation=quotation,
                user=request.user,
                payment_method_id=payment_method_id,
                amount_received=amount_received,
                line_item_ids=line_item_ids
            )
            return Response({
                'message': f"Cotización convertida en Venta exitosamente (Factura {sale.invoice_number}).",
                'sale_id': sale.id,
                'invoice_number': sale.invoice_number,
                'total': float(sale.total),
                'quotation': QuotationDetailSerializer(quotation, context={'request': request}).data
            })
        except ValueError as ve:
            return Response({'error': str(ve)}, status=400)
        except Exception as e:
            return Response({'error': f"Error convirtiendo cotización: {str(e)}"}, status=500)
