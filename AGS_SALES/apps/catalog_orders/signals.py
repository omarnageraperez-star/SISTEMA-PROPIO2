from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.cache import cache
from .models import CatalogOrder

@receiver(post_save, sender=CatalogOrder)
def notify_new_catalog_order(sender, instance, created, **kwargs):
    """
    Signal para notificar cuando se crea un nuevo pedido del catálogo
    """
    if created:
        # Guardar en cache para polling en tiempo real
        cache.set('new_catalog_order', {
            'order_id': instance.id,
            'order_number': instance.order_number,
            'customer_name': instance.customer_name,
            'total': float(instance.total),
            'created_at': instance.created_at.isoformat(),
            'table_name': instance.table.name if instance.table else None
        }, timeout=300)  # 5 minutos
        
        # Incrementar contador de pedidos pendientes
        pending_count = cache.get('pending_catalog_orders_count', 0)
        cache.set('pending_catalog_orders_count', pending_count + 1, timeout=300)
