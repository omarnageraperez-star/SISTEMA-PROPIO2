from rest_framework import serializers
from .models import Customer, CustomerSegment

class CustomerSerializer(serializers.ModelSerializer):
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True, default=None)
    document_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)

    def validate_email(self, value):
        # Convert empty string to None to avoid unique constraint collisions
        return value if value else None

    def validate_document_number(self, value):
        # Convert empty string to None to avoid unique constraint collisions
        return value if value else None

    class Meta:
        model = Customer
        fields = '__all__'

class CustomerSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerSegment
        fields = '__all__'
