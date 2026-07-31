import MySQLdb
import os
from dotenv import load_dotenv

load_dotenv()

host = os.environ.get('DB_HOST', '127.0.0.1')
user = os.environ.get('DB_USER', 'root')
password = os.environ.get('DB_PASSWORD', '')
db_name = os.environ.get('DB_NAME', 'ags_sales')

try:
    print(f"Connecting to MySQL at {host} with user {user}...")
    conn = MySQLdb.connect(host=host, user=user, password=password)
    cursor = conn.cursor()
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    print(f"Database '{db_name}' created or already exists.")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error creating database: {e}")
