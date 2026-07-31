from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import pandas as pd
import sqlite3
from sqlalchemy import create_engine
import os

@staff_member_required
def import_database_view(request):
    if request.method == 'POST' and request.FILES.get('db_file'):
        uploaded_file = request.FILES['db_file']
        table_name = request.POST.get('table_name', 'imported_table')
        
        fs = FileSystemStorage()
        filename = fs.save(uploaded_file.name, uploaded_file)
        file_path = fs.path(filename)
        
        # Build MySQL SQLAlchemy Engine based on Django settings
        db_settings = settings.DATABASES['default']
        user = db_settings['USER']
        password = db_settings['PASSWORD']
        host = db_settings['HOST']
        port = db_settings.get('PORT', '3306')
        db_name = db_settings['NAME']
        
        mysql_engine = create_engine(f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}")
        
        try:
            # Detect file type and extract data into Pandas DataFrames
            if filename.endswith('.sqlite3') or filename.endswith('.db'):
                # Handle SQLite databases
                sqlite_conn = sqlite3.connect(file_path)
                # Get all tables
                tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table';", sqlite_conn)
                
                for index, row in tables.iterrows():
                    t_name = row['name']
                    if t_name.startswith('sqlite_'): continue
                    df = pd.read_sql_query(f"SELECT * FROM {t_name}", sqlite_conn)
                    # Upload to MySQL
                    df.to_sql(name=t_name, con=mysql_engine, if_exists='replace', index=False)
                
                sqlite_conn.close()
                messages.success(request, f"¡Base de datos SQLite migrada completamente a MySQL de forma exitosa!")
                
            elif filename.endswith('.csv'):
                df = pd.read_csv(file_path)
                df.to_sql(name=table_name, con=mysql_engine, if_exists='replace', index=False)
                messages.success(request, f"¡Archivo CSV convertido e importado como tabla '{table_name}' exitosamente!")
                
            elif filename.endswith('.xlsx') or filename.endswith('.xls'):
                df = pd.read_excel(file_path)
                df.to_sql(name=table_name, con=mysql_engine, if_exists='replace', index=False)
                messages.success(request, f"¡Hoja de cálculo importada como tabla '{table_name}' exitosamente!")
                
            else:
                messages.error(request, "Formato no soportado. Usa .sqlite3, .db, .csv o .xlsx")
                
        except Exception as e:
            messages.error(request, f"Error durante la importación: {str(e)}")
            
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)
                
        return redirect('admin:index')
        
    return render(request, 'admin/db_importer.html', {
        'title': 'Importador Universal de DB a MySQL',
    })
