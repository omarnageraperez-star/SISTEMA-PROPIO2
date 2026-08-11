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

        # Clear license cache immediately when settings are saved to reflect changes instantly
        if 'users/settings/' in path and request.method == 'POST':
            cache.delete('_license_settings')

        # Exclude admin, login/auth and initial setup/health endpoints
        excluded = (
            path.startswith('/admin/') or
            'login' in path or
            'token' in path or
            'check-admin' in path or
            'register' in path or
            'health' in path or
            'ping' in path or
            ('settings' in path and request.method == 'GET')
        )
        if excluded:
            return self.get_response(request)

        # Manually authenticate JWT token to determine request.user in middleware
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                from apps.users.models import User
                token_str = auth_header.split(' ')[1]
                access_token = AccessToken(token_str)
                user_id = access_token['user_id']
                request.user = User.objects.get(id=user_id)
            except Exception:
                pass

        # SUPERADMIN always bypasses the license block so they can reactivate
        try:
            if request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'SUPERADMIN':
                return self.get_response(request)
        except Exception:
            pass

        # Retrieve licensing settings (cached)
        settings_dict = self._get_settings()

        license_status = settings_dict.get('license_status', 'ACTIVE')
        expires_at_str = settings_dict.get('license_expires_at', '')
        grace_days = int(settings_dict.get('license_grace_days', '3'))
        warning_days = int(settings_dict.get('license_warning_days', '7'))

        # Check device locking (if X-Device-UUID is provided by the desktop app)
        device_uuid = request.META.get('HTTP_X_DEVICE_UUID')
        if device_uuid:
            registered_device = settings_dict.get('license_device_id', '')
            if not registered_device:
                # Auto-register this device UUID on first connection
                try:
                    from apps.users.models import SystemSetting
                    setting, created = SystemSetting.objects.get_or_create(key='license_device_id')
                    setting.value = device_uuid
                    setting.save()
                    # Clear cache
                    cache.delete('_license_settings')
                    settings_dict['license_device_id'] = device_uuid
                except Exception:
                    pass
            elif registered_device != device_uuid:
                # Device mismatch block
                return JsonResponse({
                    'error': 'license_device_mismatch',
                    'detail': 'Esta licencia ya está vinculada a otro equipo de cómputo. No se permite el acceso desde múltiples dispositivos.',
                    'contact_phone': settings_dict.get('license_contact', '+57 300 000 0000'),
                    'payment_methods': 'Por favor contáctenos para transferir la licencia o adquirir licencias adicionales.'
                }, status=402)

        # Expiration logic
        is_expired = license_status == 'EXPIRED'
        is_grace_period = False
        remaining_days = 999
        expires_at = None

        if expires_at_str:
            try:
                from django.utils import timezone
                # support both YYYY-MM-DD HH:MM and YYYY-MM-DD
                if ' ' in expires_at_str:
                    expires_at = datetime.datetime.strptime(expires_at_str, '%Y-%m-%d %H:%M')
                else:
                    # assume end of day for date-only formats
                    base_date = datetime.datetime.strptime(expires_at_str, '%Y-%m-%d')
                    expires_at = datetime.datetime.combine(base_date.date(), datetime.time(23, 59, 59))
                
                expires_at = timezone.make_aware(expires_at)
                now = timezone.now()
                
                if now > expires_at:
                    delta = now - expires_at
                    if delta.days < grace_days:
                        is_grace_period = True
                        grace_days_left = grace_days - delta.days
                    else:
                        is_expired = True
                else:
                    delta = expires_at - now
                    remaining_days = delta.days
            except Exception:
                pass

        # Send Automatic SMTP Notification (using DB tracking so it only ever triggers ONCE per expiration setting)
        if expires_at:
            try:
                from django.utils import timezone
                now = timezone.now()
                time_left = expires_at - now
                
                warning_sent_for = settings_dict.get('license_warning_email_sent_for', '')
                expired_sent_for = settings_dict.get('license_expired_email_sent_for', '')
                
                # Warning email (3 days before)
                if 0 < time_left.days <= 3 and warning_sent_for != expires_at_str:
                    from core.mail import send_system_notification
                    from apps.users.models import SystemSetting
                    
                    smtp_user = settings_dict.get('smtp_user')
                    business_name = settings_dict.get('business_name', 'AGS SALES')
                    subject = f"Advertencia: Su licencia de {business_name} vencerá pronto"
                    html = f"""
                    <h3>Estimado cliente,</h3>
                    <p>Le informamos que la licencia de uso de su sistema POS/ERP <b>{business_name}</b> vencerá el próximo <b>{expires_at_str}</b>.</p>
                    <p>Le restan aproximadamente {time_left.days} días de uso normal.</p>
                    <p>Evite la suspensión del sistema realizando su pago a tiempo.</p>
                    <p>Métodos de pago:<br/>{settings_dict.get('license_payment_methods', 'Contacto con soporte')}</p>
                    <p>Soporte: {settings_dict.get('license_contact')}</p>
                    """
                    # Send and save to DB immediately to avoid concurrent duplicates
                    send_system_notification(subject, html, recipient=smtp_user)
                    
                    setting, created = SystemSetting.objects.get_or_create(key='license_warning_email_sent_for')
                    setting.value = expires_at_str
                    setting.save()
                    cache.delete('_license_settings')

                # Expired email (on expiration day)
                elif time_left.total_seconds() <= 0 and expired_sent_for != expires_at_str:
                    from core.mail import send_system_notification
                    from apps.users.models import SystemSetting
                    
                    smtp_user = settings_dict.get('smtp_user')
                    business_name = settings_dict.get('business_name', 'AGS SALES')
                    subject = f"Aviso de Suspensión: Licencia expirada de {business_name}"
                    html = f"""
                    <h3>Estimado cliente,</h3>
                    <p>Le informamos que la licencia de uso de su sistema POS/ERP <b>{business_name}</b> ha expirado el <b>{expires_at_str}</b>.</p>
                    <p>El sistema entrará en suspensión. Por favor contáctenos para reactivar su servicio.</p>
                    <p>Métodos de pago:<br/>{settings_dict.get('license_payment_methods', 'Contacto con soporte')}</p>
                    <p>Soporte: {settings_dict.get('license_contact')}</p>
                    """
                    # Send and save to DB immediately to avoid concurrent duplicates
                    send_system_notification(subject, html, recipient=smtp_user)
                    
                    setting, created = SystemSetting.objects.get_or_create(key='license_expired_email_sent_for')
                    setting.value = expires_at_str
                    setting.save()
                    cache.delete('_license_settings')
            except Exception:
                pass

        # Handle hard block
        if is_expired:
            return JsonResponse({
                'error': 'license_expired',
                'detail': settings_dict.get('license_message', 'Su licencia de uso ha expirado por falta de pago.'),
                'contact_phone': settings_dict.get('license_contact', '+57 300 000 0000'),
                'payment_methods': settings_dict.get('license_payment_methods', 'Por favor contáctenos para reactivar su servicio.')
            }, status=402)

        # Handle grace period soft block
        if is_grace_period:
            bypass_grace = request.META.get('HTTP_X_BYPASS_GRACE') == 'true'
            if not bypass_grace:
                return JsonResponse({
                    'error': 'license_grace_period',
                    'detail': f'Su licencia venció el {expires_at_str}. Su sistema se encuentra en Período de Gracia.',
                    'grace_days_left': grace_days_left,
                    'contact_phone': settings_dict.get('license_contact', '+57 300 000 0000'),
                    'payment_methods': settings_dict.get('license_payment_methods', 'Por favor contáctenos para reactivar su servicio.')
                }, status=402)

        # Process the request
        response = self.get_response(request)

        # Add license headers for non-blocking UI info (warning banners)
        if expires_at_str:
            response['X-License-Status'] = 'WARNING' if remaining_days <= warning_days else 'ACTIVE'
            response['X-License-Remaining-Days'] = str(remaining_days)
            response['X-License-Expires-At'] = expires_at_str

        return response
