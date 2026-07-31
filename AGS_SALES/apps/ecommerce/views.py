from rest_framework import viewsets, permissions
from .models import Cart, CartItem, WebOrder
from .serializers import CartSerializer, CartItemSerializer, WebOrderSerializer

class CartViewSet(viewsets.ModelViewSet):
    queryset = Cart.objects.all()
    serializer_class = CartSerializer
    # Carts can be created by anonymous users (guests)
    permission_classes = [permissions.AllowAny]

class CartItemViewSet(viewsets.ModelViewSet):
    queryset = CartItem.objects.all()
    serializer_class = CartItemSerializer
    permission_classes = [permissions.AllowAny]

class WebOrderViewSet(viewsets.ModelViewSet):
    queryset = WebOrder.objects.all()
    serializer_class = WebOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
