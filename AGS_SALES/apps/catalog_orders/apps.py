from django.apps import AppConfig

class CatalogOrdersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.catalog_orders'
    verbose_name = 'Pedidos del Catálogo'

    def ready(self):
        import apps.catalog_orders.signals
