from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, UserProfileView, SystemSettingsView, AdminUserViewSet, UploadUpdateView
from .api_views import CheckAdminView, SetupAdminView, DebugDBView

router = DefaultRouter()
router.register(r'admin-users', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    path('debug-db/', DebugDBView.as_view(), name='debug_db'),
    path('check-admin/', CheckAdminView.as_view(), name='check_admin'),
    path('setup-admin/', SetupAdminView.as_view(), name='setup_admin'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('settings/', SystemSettingsView.as_view(), name='system_settings'),
    path('upload-update/', UploadUpdateView.as_view(), name='upload_update'),
    path('', include(router.urls)),
]

