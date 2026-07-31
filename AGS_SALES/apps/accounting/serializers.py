from rest_framework import serializers
from .models import CashRegister, CashShift, CashMovement, CompanyAsset

class CashRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashRegister
        fields = '__all__'

class CashMovementSerializer(serializers.ModelSerializer):
    register_name = serializers.ReadOnlyField(source='shift.cash_register.name')
    username = serializers.ReadOnlyField(source='shift.user.username')

    class Meta:
        model = CashMovement
        fields = '__all__'

class CashShiftSerializer(serializers.ModelSerializer):
    movements = CashMovementSerializer(many=True, read_only=True)
    register_name = serializers.ReadOnlyField(source='cash_register.name')
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = CashShift
        fields = '__all__'

class CompanyAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyAsset
        fields = '__all__'
