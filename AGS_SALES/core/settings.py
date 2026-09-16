"""
Django settings for AGS_SALES project.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-development-key-for-ags-sales')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*']

# Application definition
INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'channels',
    'db_importer',
    
    # Local apps
    'apps.users',
    'apps.inventory',
    'apps.sales',
    'apps.purchases',
    'apps.crm',
    'apps.ecommerce',
    'apps.accounting',
    'apps.reports',
    'apps.billing',
    'apps.catalog_orders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'core.licensing_middleware.LicensingMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database
DB_HOST = os.environ.get('DB_HOST', 'db')
DB_NAME = os.environ.get('DB_NAME', 'ags_sales')
DB_USER = os.environ.get('DB_USER', 'root')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'root')
DB_PORT = os.environ.get('DB_PORT', '3306')

# Database configuration - Fallback to SQLite if MySQL host is local or not defined
USE_SQLITE = DB_HOST in ('127.0.0.1', 'localhost', 'db', '')


if USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
        }
    }
else:
    # Detectar si es Supabase (PostgreSQL) o Hostinger (MySQL)
    db_engine = 'django.db.backends.postgresql' if DB_PORT in ('5432', '6543') or os.environ.get('DB_ENGINE') == 'postgresql' else 'django.db.backends.mysql'
    
    # En Vercel (Serverless) o con Supabase Pooler, CONN_MAX_AGE debe ser 0 para no agotar las conexiones del pool (límite 15 en Session mode)
    default_max_age = 0 if (os.environ.get('VERCEL') or os.environ.get('VERCEL_ENV') or DB_PORT == '6543') else 600
    conn_max_age = int(os.environ.get('CONN_MAX_AGE', default_max_age))

    db_options = {}
    if db_engine == 'django.db.backends.mysql':
        db_options = {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        }

    DATABASES = {
        'default': {
            'ENGINE': db_engine,
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            'CONN_MAX_AGE': conn_max_age,
            'DISABLE_SERVER_SIDE_CURSORS': True if DB_PORT == '6543' or 'pooler.supabase.com' in DB_HOST else False,
            'OPTIONS': db_options,
        }
    }


# Cache system para acelerar tiempos de carga de plantillas y vistas
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'ags-sales-cache',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Internationalization
LANGUAGE_CODE = 'es'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')] if os.path.exists(os.path.join(BASE_DIR, 'static')) else []

# Django 5 storage configuration — WhiteNoise for serving admin CSS on Vercel
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

WHITENOISE_MANIFEST_STRICT = False

# Configuración para subida de archivos pesados (Instaladores de ~500MB)
DATA_UPLOAD_MAX_MEMORY_SIZE = 524288000  # 500 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 524288000  # 500 MB

MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.CustomPageNumberPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
}

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ['*']
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_EXPOSE_HEADERS = ['X-License-Status', 'X-License-Remaining-Days', 'X-License-Expires-At']

# Spectacular Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'AGS_SALES API',
    'DESCRIPTION': 'API for AGS_SALES ERP/POS and E-commerce system',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# Celery
CELERY_BROKER_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL', 'redis://redis:6379/0')

# Jazzmin settings
JAZZMIN_SETTINGS = {
    "site_title": "Assia Group Solutions",
    "site_header": "AGS SALES",
    "site_brand": "Assia Group Solutions",
    "site_logo": "admin_custom/img/logo.png",
    "welcome_sign": "Bienvenido al Sistema de Assia Group Solutions",
    "copyright": "Assia Group Solutions",
    "show_ui_builder": False,
    "user_avatar": "avatar",
    "usermenu_links": [
        {"name": "Editar mi Perfil", "url": "/admin/users/user/", "icon": "fas fa-user-edit"},
    ],
    "custom_css": "admin_custom/css/premium.css",
    "custom_js": "admin_custom/js/premium.js",
    "topmenu_links": [
        {"name": "Home",  "url": "admin:index", "permissions": ["auth.view_user"]},
        {"model": "auth.User"},
        {"app": "inventory"},
    ],
    "custom_links": {
        "reports": [{
            "name": "Importador DB Universal", 
            "url": "import_db", 
            "icon": "fas fa-database",
            "permissions": ["auth.view_user"]
        }]
    },
    "show_sidebar": True,
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.Group": "fas fa-users",
        "users.User": "fas fa-user",
        "users.Role": "fas fa-id-badge",
        "inventory.Product": "fas fa-box",
        "inventory.Warehouse": "fas fa-warehouse",
        "inventory.Stock": "fas fa-cubes",
        "inventory.Category": "fas fa-tags",
        "inventory.Brand": "fas fa-copyright",
        "crm.Customer": "fas fa-address-book",
        "crm.CustomerInteraction": "fas fa-comments",
        "purchases.Supplier": "fas fa-truck",
        "purchases.PurchaseOrder": "fas fa-file-invoice",
        "sales.Sale": "fas fa-shopping-cart",
        "sales.Payment": "fas fa-money-bill-wave",
        "ecommerce.WebOrder": "fas fa-globe",
        "ecommerce.Cart": "fas fa-shopping-basket",
        "accounting.CashRegister": "fas fa-cash-register",
        "accounting.CashShift": "fas fa-clock",
        "accounting.CashMovement": "fas fa-exchange-alt",
    },
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",
}

JAZZMIN_UI_TWEAKS = {
    "navbar": "navbar-dark",
    "theme": "pulse",
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_child_indent": True,
}

DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
