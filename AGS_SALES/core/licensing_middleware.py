import datetime
from django.http import JsonResponse
from django.core.cache import cache

class LicensingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def _get_settings(self):
        """Cache license settings for 60 seconds to avoid hammering the DB on every request."""
        cached = cache.get('_license_settings')
        if cached is not None:
            return cached
        try:
            from apps.users.models import SystemSetting
            settings_dict = {s.key: s.value for s in SystemSetting.objects.all()}
        except Exception:
            settings_dict = {}
        cache.set('_license_settings', settings_dict, 60)
        return settings_dict

    def __call__(self, request):
        path = request.path

        # Exclude admin, login/auth and initial setup/health endpoints
        excluded = (
            path.startswith('/admin/') or
            'login' in path or
            'token' in path or
            'check-admin' in path or
            'register' in path or
            'health' in path or
            'ping' in path
        )
        if excluded:
            return self.get_response(request)

        # SUPERADMIN always bypasses the license block so they can reactivate
        try:
            if request.user.is_authenticated and getattr(request.user, 'role', None) == 'SUPERADMIN':
                return self.get_response(request)
        except Exception:
            pass

        # Retrieve licensing settings (cached)
        settings_dict = self._get_settings()

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
