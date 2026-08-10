from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from .models import PaymentMethod, Sale, SaleDetail, Payment, CreditPayment
from .serializers import (
    PaymentMethodSerializer, SaleSerializer,
    SaleDetailSerializer, PaymentSerializer
)

class PaymentMethodViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAuthenticated]

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all().order_by('-created_at').select_related(
        'customer', 'user', 'warehouse'
    ).prefetch_related(
        'details', 'payments', 'details__product', 'payments__payment_method',
        'credit_payments', 'credit_payments__registered_by'
    )
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'customer', 'warehouse', 'is_credit', 'credit_status']
    search_fields = ['invoice_number']

    @action(detail=False, methods=['get'], url_path='credits')
    def list_credits(self, request):
        queryset = self.queryset.filter(is_credit=True)
        customer_id = request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        status_filter = request.query_params.get('credit_status')
        if status_filter:
            queryset = queryset.filter(credit_status=status_filter)
        else:
            queryset = queryset.exclude(credit_status='PAID')
            
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='pay-credit')
    def pay_credit(self, request, pk=None):
        sale = self.get_object()
        if not sale.is_credit:
            return Response({"detail": "Esta venta no es a crédito."}, status=400)
            
        amount = request.data.get('amount')
        note = request.data.get('note', '')
        
        if not amount:
            return Response({"detail": "Debe especificar el monto del abono."}, status=400)
            
        try:
            amount = float(amount)
        except ValueError:
            return Response({"detail": "El monto debe ser un número válido."}, status=400)
            
        if amount <= 0:
            return Response({"detail": "El monto debe ser mayor a cero."}, status=400)
            
        pending = float(sale.total) - float(sale.amount_paid)
        if amount > pending + 0.01:
            return Response({"detail": f"El monto excede el saldo pendiente (${pending:.2f})."}, status=400)
            
        from django.db import transaction
        from apps.accounting.models import CashShift, CashMovement
        with transaction.atomic():
            cp = CreditPayment.objects.create(
                sale=sale,
                amount=amount,
                note=note,
                registered_by=request.user if request.user.is_authenticated else None
            )
            
            sale.amount_paid = float(sale.amount_paid) + amount
            if sale.amount_paid >= sale.total - 0.01:
                sale.credit_status = 'PAID'
            else:
                sale.credit_status = 'PARTIAL'
            sale.save()
            
            active_shift = CashShift.objects.filter(user=request.user, is_open=True).first()
            if active_shift:
                CashMovement.objects.create(
                    shift=active_shift,
                    type='IN',
                    amount=amount,
                    description=f"Abono a Factura {sale.invoice_number}"
                )
                
        return Response({
            "detail": "Abono registrado exitosamente.",
            "sale": self.get_serializer(sale).data
        })

    @action(detail=False, methods=['get'], url_path='credit-summary')
    def credit_summary(self, request):
        credits = Sale.objects.filter(is_credit=True)
        unpaid = credits.exclude(credit_status='PAID')
        
        debt_data = unpaid.aggregate(
            total_amount=Sum('total'),
            total_paid=Sum('amount_paid')
        )
        total_total = debt_data['total_amount'] or 0
        total_paid = debt_data['total_paid'] or 0
        total_debt = total_total - total_paid
        
        debtors_count = unpaid.values('customer').distinct().count()
        
        today = timezone.localdate()
        overdue = unpaid.filter(due_date__lt=today)
        overdue_data = overdue.aggregate(
            total_amount=Sum('total'),
            total_paid=Sum('amount_paid')
        )
        overdue_total = overdue_data['total_amount'] or 0
        overdue_paid = overdue_data['total_paid'] or 0
        total_overdue = overdue_total - overdue_paid
        
        return Response({
            "total_debt": total_debt,
            "debtors_count": debtors_count,
            "total_overdue": total_overdue
        })

class SaleDetailViewSet(viewsets.ModelViewSet):
    queryset = SaleDetail.objects.all()
    serializer_class = SaleDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
