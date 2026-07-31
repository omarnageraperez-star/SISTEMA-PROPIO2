from rest_framework import generics, permissions, viewsets
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
        
        for key, value in data.items():
            SystemSetting.objects.update_or_create(
                key=key,
                defaults={'value': str(value) if value is not None else ''}
            )
            
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
    Allows access only to users with SUPERADMIN role or is_superuser.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and 
                    (request.user.role == 'SUPERADMIN' or request.user.is_superuser))

class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        # Optional: Prevent regular superadmins from seeing other superadmins if needed
        return super().get_queryset()
