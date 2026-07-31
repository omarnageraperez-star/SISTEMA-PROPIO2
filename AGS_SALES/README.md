# AGS SALES - Backend

Este es el backend del sistema AGS SALES (construido con Django).

## Requisitos
- Python 3.10+
- Base de datos MySQL configurada en el archivo `.env`

## Comandos para Iniciar el Backend

### 1. Iniciar localmente (solo accesible desde tu computadora)
```powershell
cd AGS_SALES
.\venv\Scripts\activate
python manage.py runserver
```

### 2. Iniciar en la red local (para que otros en tu red puedan acceder)
Bindeando a todas las interfaces (`0.0.0.0`) o a tu IP local (`192.168.1.18`):
```powershell
cd AGS_SALES
.\venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000
```
O directamente con tu IP:
```powershell
python manage.py runserver 192.168.1.18:8000
```
