from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Catálogo Público Digital
    path('catalogo/', include('apps.catalog_orders.urls')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # App URLs
    path('admin-tools/', include('db_importer.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/crm/', include('apps.crm.urls')),
    path('api/purchases/', include('apps.purchases.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/ecommerce/', include('apps.ecommerce.urls')),
    path('api/accounting/', include('apps.accounting.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/configuracion/facturacion/', include('apps.billing.urls')),
    path('api/catalog-orders/', include('apps.catalog_orders.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
