from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class CheckAdminView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        has_admin = User.objects.filter(is_superuser=True).exists()
        return Response({"has_admin": has_admin})

class SetupAdminView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        if User.objects.filter(is_superuser=True).exists():
            return Response({"error": "Administrator already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        phone = request.data.get('phone', '')
        first_name = request.data.get('first_name', '')
        
        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Create superuser with role ADMIN and phone_number
            user = User.objects.create_superuser(
                username=username, 
                email=email, 
                password=password,
                role='SUPERADMIN',
                phone_number=phone,
                first_name=first_name
            )
            return Response({"message": "Administrator created successfully!"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DebugDBView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        from django.conf import settings
        from apps.sales.models import Sale
        db_conf = settings.DATABASES['default']
        safe_conf = {k: v for k, v in db_conf.items() if k != 'PASSWORD'}
        return Response({
            "database_config": safe_conf,
            "sales_count": Sale.objects.all().count(),
            "credits_count": Sale.objects.filter(is_credit=True).count(),
            "environment_keys": list(os.environ.keys())
        })
