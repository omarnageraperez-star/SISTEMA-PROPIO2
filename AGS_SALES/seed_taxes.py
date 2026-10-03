import os
from apps.billing.models import Tax

taxes = [
    # IVA
    {'name': 'IVA General', 'rate': 19.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': True, 'description': 'Impuesto al Valor Agregado general (19%)'},
    {'name': 'IVA Diferencial', 'rate': 5.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'IVA tarifa especial (5%)'},
    {'name': 'IVA Exento/Excluido', 'rate': 0.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Productos exentos o excluidos de IVA (0%)'},

    # Impoconsumo (INC)
    {'name': 'Impoconsumo Restaurantes y Bares', 'rate': 8.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Impuesto Nacional al Consumo (8%)'},
    {'name': 'Impoconsumo Vehículos/Telefonía', 'rate': 4.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Impoconsumo (4%)'},
    {'name': 'Impoconsumo Vehículos Lujo', 'rate': 16.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Impoconsumo (16%)'},

    # Impuestos Saludables
    {'name': 'Impuesto Saludable ICUI (Ultraprocesados)', 'rate': 20.00, 'category': 'TAX', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Impuesto a productos comestibles ultraprocesados industrialmente (20% para 2025/2026)'},
    # IBUA is variable based on sugar content per 100ml, so let's put it as fixed amount placeholder or average
    {'name': 'Impuesto Saludable IBUA (Bebidas Azucaradas)', 'rate': 38.00, 'category': 'TAX', 'tax_type': 'FIXED_AMOUNT', 'is_active': True, 'is_default': False, 'description': 'Valor fijo en pesos por cada 100ml según gramos de azúcar (ej. $38 o $65 para 2025/2026)'},

    # Bolsas Plásticas
    {'name': 'Impuesto Nacional al Consumo de Bolsas Plásticas', 'rate': 66.00, 'category': 'TAX', 'tax_type': 'FIXED_AMOUNT', 'is_active': True, 'is_default': False, 'description': 'Monto fijo cobrado por cada bolsa plástica'},

    # Retenciones
    {'name': 'ReteFuente (Compras Generales - Declarantes)', 'rate': 2.50, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención en la fuente por compras (2.5%)'},
    {'name': 'ReteFuente (Compras Generales - No Declarantes)', 'rate': 3.50, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención en la fuente por compras (3.5%)'},
    {'name': 'ReteFuente (Servicios)', 'rate': 4.00, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención en la fuente por servicios (4% general)'},
    {'name': 'ReteFuente (Honorarios)', 'rate': 11.00, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención en la fuente por honorarios (11%)'},
    
    {'name': 'ReteIVA', 'rate': 15.00, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención de IVA (15% del valor del IVA)'},
    
    # ReteICA is municipal so let's add a couple common ones
    {'name': 'ReteICA (4.14 x 1000)', 'rate': 0.414, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención de Industria y Comercio (0.414%)'},
    {'name': 'ReteICA (9.66 x 1000)', 'rate': 0.966, 'category': 'WITHHOLDING', 'tax_type': 'PERCENTAGE', 'is_active': True, 'is_default': False, 'description': 'Retención de Industria y Comercio (0.966%)'},
]

for t in taxes:
    Tax.objects.get_or_create(name=t['name'], defaults=t)

print("Taxes successfully populated!")
