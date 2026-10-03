from django.db import models

class BillingConfiguration(models.Model):
    ENVIRONMENT_CHOICES = [
        ('HABILITACION', 'Habilitación'),
        ('PRODUCCION', 'Producción'),
    ]

    MODE_CHOICES = [
        ('POS', 'POS Electrónico'),
        ('ELECTRONIC', 'Factura Electrónica'),
    ]

    allow_pos = models.BooleanField("Permitir Facturación POS", default=True)
    allow_electronic = models.BooleanField("Permitir Facturación Electrónica", default=False)
    default_mode = models.CharField("Modo Predeterminado", max_length=20, choices=MODE_CHOICES, default='POS')
    allow_manual_change = models.BooleanField("Permitir Cambio Manual Durante la Venta", default=True)
    dian_environment = models.CharField("Ambiente DIAN", max_length=20, choices=ENVIRONMENT_CHOICES, default='HABILITACION')
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de Facturación"
        verbose_name_plural = "Configuraciones de Facturación"

    def __str__(self):
        return f"Configuración Global (Ambiente: {self.get_dian_environment_display()})"

    def save(self, *args, **kwargs):
        # Ensure only one configuration exists (Singleton)
        if not self.pk and BillingConfiguration.objects.exists():
            # if you'll only have one object, set its pk to the existing one
            self.pk = BillingConfiguration.objects.first().pk
        super(BillingConfiguration, self).save(*args, **kwargs)


class DIANResolution(models.Model):
    TYPE_CHOICES = [
        ('POS', 'Resolución POS'),
        ('ELECTRONIC', 'Resolución Facturación Electrónica'),
    ]

    resolution_type = models.CharField("Tipo de Resolución", max_length=20, choices=TYPE_CHOICES)
    resolution_number = models.CharField("Número de Resolución", max_length=50, unique=True)
    prefix = models.CharField("Prefijo", max_length=10, blank=True, null=True)
    start_range = models.BigIntegerField("Rango Inicial")
    end_range = models.BigIntegerField("Rango Final")
    current_number = models.BigIntegerField("Número Actual", default=0)
    
    valid_from = models.DateField("Válido Desde")
    valid_to = models.DateField("Válido Hasta")
    
    technical_key = models.CharField("Clave Técnica DIAN", max_length=255, blank=True, null=True)
    is_active = models.BooleanField("Activa", default=True)

    class Meta:
        verbose_name = "Resolución DIAN"
        verbose_name_plural = "Resoluciones DIAN"

    def __str__(self):
        return f"{self.get_resolution_type_display()} - {self.prefix or ''} {self.resolution_number}"


class DIANCertificate(models.Model):
    name = models.CharField("Nombre del Certificado", max_length=100)
    certificate_file = models.FileField("Archivo de Certificado (.p12/.pfx)", upload_to='certificates/')
    password = models.CharField("Contraseña del Certificado", max_length=255) # In real prod, this should be encrypted
    expiration_date = models.DateField("Fecha de Expiración")
    is_active = models.BooleanField("Activo", default=True)

    class Meta:
        verbose_name = "Certificado Digital DIAN"
        verbose_name_plural = "Certificados Digitales DIAN"

    def __str__(self):
        return f"Certificado: {self.name} (Expira: {self.expiration_date})"

class Tax(models.Model):
    TAX_CATEGORY_CHOICES = [
        ('TAX', 'Impuesto (Facturado al Cliente)'),
        ('WITHHOLDING', 'Retención (Aplicada por el Cliente)'),
    ]

    TAX_TYPE_CHOICES = [
        ('PERCENTAGE', 'Porcentaje (%)'),
        ('FIXED_AMOUNT', 'Monto Fijo ($)'),
    ]

    name = models.CharField("Nombre del Impuesto", max_length=100)
    category = models.CharField("Categoría", max_length=20, choices=TAX_CATEGORY_CHOICES, default='TAX')
    tax_type = models.CharField("Tipo de Cobro", max_length=20, choices=TAX_TYPE_CHOICES, default='PERCENTAGE')
    rate = models.DecimalField("Tarifa / Monto", max_digits=12, decimal_places=2)
    description = models.TextField("Descripción", blank=True, null=True)
    is_active = models.BooleanField("Activo", default=True)
    is_default = models.BooleanField("Aplicar por Defecto", default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Impuesto / Retención"
        verbose_name_plural = "Impuestos y Retenciones"

    def __str__(self):
        if self.tax_type == 'PERCENTAGE':
            return f"{self.name} ({self.rate}%)"
        return f"{self.name} (${self.rate})"
