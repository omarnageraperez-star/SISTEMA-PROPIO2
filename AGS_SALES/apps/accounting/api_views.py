from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import CashRegister, CashShift
from decimal import Decimal

class CashRegisterOptionsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Create a default box if none exists
        if not CashRegister.objects.exists():
            CashRegister.objects.create(name="Caja 01")
            
        boxes = CashRegister.objects.filter(is_active=True).values('id', 'name')
        return Response({"registers": list(boxes)})
        
    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({"error": "El nombre de la caja es requerido."}, status=status.HTTP_400_BAD_REQUEST)
            
        box = CashRegister.objects.create(name=name)
        return Response({"id": box.id, "name": box.name}, status=status.HTTP_201_CREATED)

class OpenCashShiftView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        register_id = request.data.get('register_id')
        initial_balance = request.data.get('initial_balance', 0.0)
        
        try:
            box = CashRegister.objects.get(id=register_id, is_active=True)
            
            # Check if there is an active shift for this box
            active_shift = CashShift.objects.filter(cash_register=box, is_open=True).first()
            if active_shift:
                return Response({"error": f"La caja {box.name} ya tiene un turno abierto por {active_shift.user.username}."}, status=status.HTTP_400_BAD_REQUEST)
                
            new_shift = CashShift.objects.create(
                cash_register=box,
                user=request.user,
                initial_balance=Decimal(str(initial_balance)),
                is_open=True
            )
            return Response({"message": "Box opened successfully.", "shift_id": new_shift.id}, status=status.HTTP_201_CREATED)
            
        except CashRegister.DoesNotExist:
            return Response({"error": "Register not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
