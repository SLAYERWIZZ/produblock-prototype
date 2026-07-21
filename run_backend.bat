@echo off
rem ==== Instala dependencias (solo la primera vez) ====
if not exist venv (
    python -m venv venv
    call venv\Scripts\activate
    pip install --quiet flask pandas werkzeug bcrypt) else (
    call venv\Scripts\activate
)

rem ==== Inicia la API Flask en modo debug (puerto 5000) ====
set FLASK_APP=backend\app.py
set FLASK_DEBUG=1
flask run
