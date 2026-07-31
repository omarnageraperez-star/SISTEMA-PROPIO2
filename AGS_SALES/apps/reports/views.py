from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Sum, Count
from django.db.models.functions import ExtractHour
from apps.sales.models import Sale, SaleDetail
from apps.inventory.models import Product

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        
        total_sales = Sale.objects.filter(status='COMPLETED').aggregate(Sum('total'))['total__sum'] or 0
        total_orders = Sale.objects.filter(status='COMPLETED').count()
        total_products = Product.objects.filter(is_active=True).count()
        
        # 1. Top Products
        top_products_qs = SaleDetail.objects.values('product__name').annotate(total_sold=Sum('quantity')).order_by('-total_sold')[:5]
        top_products = [{"name": item['product__name'] or "Producto Desconocido", "value": float(item['total_sold'] or 0)} for item in top_products_qs]

        # 2. Sales by Hour in Python (Database-independent and timezone-safe)
        sales_dict = {f"{h:02d}:00": 0.0 for h in range(7, 23)} # From 7am to 10pm usually
        completed_sales_qs = Sale.objects.filter(status='COMPLETED', created_at__isnull=False).only('created_at', 'total')
        
        for sale in completed_sales_qs:
            local_dt = timezone.localtime(sale.created_at)
            hour_str = f"{local_dt.hour:02d}:00"
            sales_dict[hour_str] = sales_dict.get(hour_str, 0.0) + float(sale.total or 0)
            
        sales_by_hour = [{"time": k, "ventas": v} for k, v in sorted(sales_dict.items())]

        # 3. AI Suggestions
        suggestions = []
        if top_products:
            suggestions.append(f"🔥 El producto '{top_products[0]['name']}' es tu Top Ventas. Verifica que tengas suficiente stock para la demanda.")
        
        # Find peak hour in python
        if completed_sales_qs.exists():
            peak_hour_str = max(sales_dict, key=sales_dict.get)
            peak_hour_sales = sales_dict[peak_hour_str]
            if peak_hour_sales > 0:
                suggestions.append(f"⏰ Tu hora pico de ventas es a las {peak_hour_str}. Asegura disponibilidad de personal a esa hora.")
            
        if total_orders > 0:
            avg_ticket = float(total_sales) / total_orders
            suggestions.append(f"💰 Tu ticket promedio general es de ${avg_ticket:,.2f}. Ofrece complementos (Upsell) para subirlo.")

        # 4. Promo metrics (Dice promo)
        promo_sales = Sale.objects.filter(status='COMPLETED', promo_percent__gt=0)
        promo_orders_count = promo_sales.count()
        promo_total_sales = promo_sales.aggregate(Sum('total'))['total__sum'] or 0
        promo_total_discount = promo_sales.aggregate(Sum('discount'))['discount__sum'] or 0
        
        non_promo_sales = Sale.objects.filter(status='COMPLETED', promo_percent=0)
        non_promo_orders_count = non_promo_sales.count()
        non_promo_total_sales = non_promo_sales.aggregate(Sum('total'))['total__sum'] or 0
        
        avg_ticket_promo = float(promo_total_sales) / promo_orders_count if promo_orders_count > 0 else 0
        avg_ticket_normal = float(non_promo_total_sales) / non_promo_orders_count if non_promo_orders_count > 0 else 0
        
        if promo_orders_count > 0:
            pct_promo = (promo_orders_count / total_orders) * 100
            suggestions.append(f"🎲 El {pct_promo:.1f}% de tus ventas se hicieron con la promoción de dados, con un total descontado de ${float(promo_total_discount):,.2f}.")
            if avg_ticket_promo > avg_ticket_normal:
                inc = ((avg_ticket_promo - avg_ticket_normal) / avg_ticket_normal) * 100 if avg_ticket_normal > 0 else 0
                suggestions.append(f"📈 ¡Muy bien! El ticket promedio con dados es de ${avg_ticket_promo:,.2f}, un {inc:.1f}% superior al ticket normal (${avg_ticket_normal:,.2f}).")
            else:
                suggestions.append(f"⚠️ El ticket con dados (${avg_ticket_promo:,.2f}) es menor al normal (${avg_ticket_normal:,.2f}). Prueba subiendo el valor mínimo para jugar.")
            
        if not suggestions:
            suggestions.append("Aún no hay suficientes datos históricos para sugerencias.")

        # 5. Recent Sales
        from apps.sales.serializers import SaleSerializer
        recent_sales_qs = Sale.objects.filter(status='COMPLETED').order_by('-created_at')[:5]
        recent_sales = SaleSerializer(recent_sales_qs, many=True).data

        from django.db.models import F, Q
        low_stock = Product.objects.filter(
            is_active=True,
            has_inventory_control=True
        ).filter(
            Q(stock__lte=F('min_stock')) | Q(stock__lte=5)
        ).count()

        return Response({
            'total_sales': total_sales,
            'total_orders': total_orders,
            'active_products': total_products,
            'low_stock': low_stock,
            'recent_sales': recent_sales,
            'top_products': top_products,
            'sales_by_hour': sales_by_hour,
            'ai_suggestions': suggestions,
            'promo_metrics': {
                'orders_count': promo_orders_count,
                'total_sales': float(promo_total_sales),
                'total_discount': float(promo_total_discount),
                'avg_ticket_promo': avg_ticket_promo,
                'avg_ticket_normal': avg_ticket_normal,
            }
        })
