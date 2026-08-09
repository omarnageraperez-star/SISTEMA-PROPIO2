from rest_framework.views import exception_handler
from django.db.models.deletion import ProtectedError
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first to get the standard error response
    response = exception_handler(exc, context)

    # If an exception is Django's ProtectedError, return a friendly 400 Bad Request
    if isinstance(exc, ProtectedError):
        msg = "Este registro no se puede eliminar porque está siendo utilizado por otros módulos del sistema (por ejemplo, tiene ventas, compras o registros contables asociados)."
        return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

    return response
