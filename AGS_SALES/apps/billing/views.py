from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import BillingConfiguration

class BillingConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = BillingConfiguration.objects.first()
        
        # Default fallback values if no config exists in DB yet
        if not config:
            return Response({
                "modo_predeterminado": "POS",
                "permitir_cambio": True,
                "facturacion_electronica_habilitada": False,
                "pos_habilitado": True
            })

        return Response({
            "modo_predeterminado": config.default_mode,
            "permitir_cambio": config.allow_manual_change,
            "facturacion_electronica_habilitada": config.allow_electronic,
            "pos_habilitado": config.allow_pos
        })

from rest_framework.viewsets import ModelViewSet
from .models import Tax
from .serializers import TaxSerializer

class TaxViewSet(ModelViewSet):
    queryset = Tax.objects.all().order_by('category', 'id')
    serializer_class = TaxSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
