from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate
from .models import CustomerUser

class CustomerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = CustomerUser
        fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'address', 'password', 'password_confirm']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = CustomerUser.objects.create_user(**validated_data)
        return user

class CustomerLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
    
    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user or not isinstance(user, CustomerUser):
            raise serializers.ValidationError("Credenciales inválidas")
        if not user.is_active:
            raise serializers.ValidationError("Usuario inactivo")
        return data

class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone', 'address', 'is_verified', 'created_at']
        read_only_fields = ['id', 'is_verified', 'created_at']

@api_view(['POST'])
@permission_classes([AllowAny])
def customer_register(request):
    """Registro de nuevo cliente"""
    serializer = CustomerRegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'message': 'Registro exitoso',
            'user': CustomerProfileSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def customer_login(request):
    """Login de cliente"""
    serializer = CustomerLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = authenticate(username=serializer.validated_data['username'], password=serializer.validated_data['password'])
        from rest_framework.authtoken.models import Token
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'message': 'Login exitoso',
            'token': token.key,
            'user': CustomerProfileSerializer(user).data
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def customer_profile(request):
    """Obtener perfil del cliente autenticado"""
    if not isinstance(request.user, CustomerUser):
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
    serializer = CustomerProfileSerializer(request.user)
    return Response(serializer.data)

@api_view(['PUT'])
def customer_update_profile(request):
    """Actualizar perfil del cliente"""
    if not isinstance(request.user, CustomerUser):
        return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
    serializer = CustomerProfileSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def customer_logout(request):
    """Logout de cliente"""
    try:
        request.user.auth_token.delete()
        return Response({'message': 'Logout exitoso'}, status=status.HTTP_200_OK)
    except:
        return Response({'message': 'Logout exitoso'}, status=status.HTTP_200_OK)
