from rest_framework import generics, permissions, viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, SystemSetting
from .serializers import UserSerializer, RegisterSerializer, SystemSettingSerializer, AdminUserSerializer
import os
from django.core.files.storage import FileSystemStorage
from django.conf import settings

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user

class SystemSettingsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        settings = SystemSetting.objects.all()
        data = {s.key: s.value for s in settings}
        return Response(data)

    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            return Response({'error': 'El formato de datos debe ser un objeto JSON'}, status=400)
        
        # Auto-adjust license dates on server-side only if they are empty
        if data.get('license_status') == 'ACTIVE':
            if not data.get('license_expires_at'):
                try:
                    import datetime
                    future_date = datetime.datetime.now() + datetime.timedelta(days=30)
                    data['license_expires_at'] = future_date.strftime('%Y-%m-%d 23:59')
                except Exception:
                    pass
        elif data.get('license_status') == 'EXPIRED':
            if not data.get('license_expires_at'):
                data['license_expires_at'] = '2026-01-01 00:00'
        
        from django.db import transaction
        
        with transaction.atomic():
            existing = {s.key: s for s in SystemSetting.objects.all()}
            to_create = []
            to_update = []
            
            for key, value in data.items():
                val_str = str(value) if value is not None else ''
                if key in existing:
                    setting = existing[key]
                    if setting.value != val_str:
                        setting.value = val_str
                        to_update.append(setting)
                else:
                    to_create.append(SystemSetting(key=key, value=val_str))
                    
            if to_create:
                SystemSetting.objects.bulk_create(to_create)
            if to_update:
                SystemSetting.objects.bulk_update(to_update, ['value'])
            
        settings = SystemSetting.objects.all()
        response_data = {s.key: s.value for s in settings}
        return Response(response_data)

class UploadUpdateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role != 'SUPERADMIN':
            return Response({'error': 'No autorizado'}, status=403)
            
        update_file = request.FILES.get('file')
        version = request.POST.get('version')
        
        if not update_file or not version:
            return Response({'error': 'Falta archivo o versión'}, status=400)
            
        updates_dir = os.path.join(settings.MEDIA_ROOT, 'updates')
        os.makedirs(updates_dir, exist_ok=True)
        
        fs = FileSystemStorage(location=updates_dir)
        if fs.exists(update_file.name):
            fs.delete(update_file.name)
            
        filename = fs.save(update_file.name, update_file)
        file_url = f"/media/updates/{filename}"
        
        SystemSetting.objects.update_or_create(key='latest_desktop_version', defaults={'value': version})
        SystemSetting.objects.update_or_create(key='latest_desktop_url', defaults={'value': file_url})
        
        return Response({'message': 'Actualización subida exitosamente', 'url': file_url, 'version': version})

class IsSuperAdmin(BasePermission):
    """
    Allows access only to users with SUPERADMIN role, is_superuser, or settings.user_management custom permission.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == 'SUPERADMIN' or request.user.is_superuser:
            return True
        custom_perms = request.user.custom_permissions or {}
        return bool(custom_perms.get('settings.user_management'))

class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        user_to_delete = self.get_object()

        # Prevent self-deletion
        if user_to_delete.pk == request.user.pk:
            return Response(
                {'detail': 'No puedes eliminar tu propio usuario.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db.models.deletion import ProtectedError
        try:
            user_to_delete.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError:
            # User has associated records — deactivate instead of hard delete
            user_to_delete.is_active = False
            user_to_delete.save(update_fields=['is_active'])
            return Response(
                {'detail': f'El usuario "{user_to_delete.username}" tiene registros asociados y fue desactivado en lugar de eliminado.'},
                status=status.HTTP_200_OK
            )

class ExportDatabaseView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from django.core.management import call_command
        import io
        from django.http import HttpResponse
        
        output = io.StringIO()
        try:
            # Exclude database-specific auto-generated contents to avoid conflicts on import
            call_command('dumpdata', indent=2, stdout=output, exclude=['contenttypes', 'auth.Permission'])
            json_data = output.getvalue()
            
            response = HttpResponse(json_data, content_type='application/json')
            response['Content-Disposition'] = 'attachment; filename="respaldo_db_ags.json"'
            return response
        except Exception as e:
            return Response({'detail': f'Error al generar el respaldo: {str(e)}'}, status=500)

