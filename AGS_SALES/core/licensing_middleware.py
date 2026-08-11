import datetime
from django.http import JsonResponse
from apps.users.models import SystemSetting

class LicensingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        # Exclude admin and login/auth endpoints
        if path.startswith('/admin/') or 'login' in path or 'token' in path:
            return self.get_response(request)

        # Retrieve licensing settings
        try:
            settings_dict = {s.key: s.value for s in SystemSetting.objects.all()}
        except Exception:
            settings_dict = {}

        license_status = settings_dict.get('license_status', 'ACTIVE')
        expires_at_str = settings_dict.get('license_expires_at', '')
        
        is_expired = license_status == 'EXPIRED'
        
        if not is_expired and expires_at_str:
            try:
                expires_at = datetime.datetime.strptime(expires_at_str, '%Y-%m-%d').date()
                if datetime.date.today() > expires_at:
                    is_expired = True
            except Exception:
                pass

        if is_expired:
            return JsonResponse({
                'error': 'license_expired',
                'detail': settings_dict.get('license_message', 'Su licencia de uso ha expirado por falta de pago.'),
                'contact_phone': settings_dict.get('license_contact', '+57 300 000 0000'),
                'payment_methods': settings_dict.get('license_payment_methods', 'Por favor contáctenos para reactivar su servicio.')
            }, status=402)

        return self.get_response(request)
