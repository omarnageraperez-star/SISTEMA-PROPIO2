from django.urls import path
from .views import import_database_view

urlpatterns = [
    path('import-db/', import_database_view, name='import_db'),
]
