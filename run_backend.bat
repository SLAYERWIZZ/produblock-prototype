@echo off
rem ==== Crear venv si no existe ====
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate

rem ==== Asegurar que todas las librerías necesarias estén instaladas ====
echo Verificando dependencias de Python...
python -m pip install --quiet flask pandas werkzeug bcrypt flask-sqlalchemy

rem ==== Inicia la API Flask en modo debug (puerto 5000) ====
set FLASK_APP=backend\app.py
set FLASK_DEBUG=1
flask run
