from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import os, datetime, shutil

app = Flask(__name__)

# Configuración de base de datos relacional (PostgreSQL en la nube, SQLite en local)
db_url = os.environ.get('DATABASE_URL', 'sqlite:///produblock.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ==================== MODELOS DE BASE DE DATOS SQL ====================

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False) # admin, vendedor, analista
    status = db.Column(db.String(20), nullable=False, default='pending') # active, pending, inactive

class Pedido(db.Model):
    __tablename__ = 'pedidos'
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.String(10), nullable=False) # Formato YYYY-MM-DD
    producto = db.Column(db.String(50), nullable=False)
    zona = db.Column(db.String(50), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_uni = db.Column(db.Float, nullable=False)
    total = db.Column(db.Float, nullable=False)

# Inicializar Base de Datos al arrancar la aplicación
with app.app_context():
    # Detectar si hay cambios en el esquema (si falta la columna 'status')
    recreate_db = False
    try:
        db.session.query(Usuario.status).first()
    except Exception as e:
        recreate_db = True
        
    if recreate_db:
        print("Recreando base de datos para aplicar columna 'status'...")
        db.drop_all()
        db.create_all()
    else:
        db.create_all()
        
    # Auto-crear usuarios por defecto si la tabla está vacía
    if not Usuario.query.filter_by(username='admin').first():
        db.session.add(Usuario(username='admin', password_hash=generate_password_hash('admin123'), role='admin', status='active'))
        db.session.add(Usuario(username='vendedor1', password_hash=generate_password_hash('vendedor123'), role='vendedor', status='active'))
        db.session.add(Usuario(username='analista1', password_hash=generate_password_hash('analista123'), role='analista', status='active'))
        db.session.commit()

# ==================== CONTROLES DE SEGURIDAD (RBAC) ====================

def check_role(allowed_roles):
    role = request.headers.get('X-User-Role')
    if not role or role not in allowed_roles:
        return False
    return True

# ==================== ENDPOINTS DE AUTENTICACIÓN ====================

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = Usuario.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        # Control de seguridad: Verificar si la cuenta ha sido aprobada por el admin
        if user.status != 'active':
            return jsonify({'status': 'error', 'msg': 'Tu cuenta está pendiente de aprobación por el administrador.'}), 403
        return jsonify({'status': 'ok', 'role': user.role}), 200
    return jsonify({'status': 'error', 'msg': 'Usuario o contraseña incorrectos'}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if Usuario.query.filter_by(username=data['username']).first():
        return jsonify({'status': 'error', 'msg': 'El usuario ya existe'}), 400
    pwd_hash = generate_password_hash(data['password'])
    nuevo_usuario = Usuario(
        username=data['username'], 
        password_hash=pwd_hash, 
        role=data.get('role', 'vendedor'),
        status='pending' # Por defecto quedan en espera de aprobación
    )
    db.session.add(nuevo_usuario)
    db.session.commit()
    return jsonify({
        'status': 'ok', 
        'msg': 'Usuario registrado con éxito. Pendiente de aprobación por el administrador.'
    }), 201

# ==================== ENDPOINTS DE USUARIOS (ADMIN ONLY) ====================

@app.route('/api/users', methods=['GET'])
def get_users():
    if not check_role(['admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    users = Usuario.query.all()
    resultado = [{
        'id': u.id,
        'username': u.username,
        'role': u.role,
        'status': u.status
    } for u in users]
    return jsonify(resultado)

@app.route('/api/users', methods=['POST'])
def admin_create_user():
    if not check_role(['admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    data = request.json
    if Usuario.query.filter_by(username=data['username']).first():
        return jsonify({'status': 'error', 'msg': 'El usuario ya existe'}), 400
    pwd_hash = generate_password_hash(data['password'])
    nuevo_usuario = Usuario(
        username=data['username'],
        password_hash=pwd_hash,
        role=data['role'],
        status=data.get('status', 'active') # Admin puede crearlo ya activo
    )
    db.session.add(nuevo_usuario)
    db.session.commit()
    return jsonify({'status': 'ok'}), 201

@app.route('/api/users/<int:user_id>/status', methods=['PUT'])
def update_user_status(user_id):
    if not check_role(['admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    data = request.json
    user = db.session.get(Usuario, user_id)
    if not user:
        return jsonify({'status': 'error', 'msg': 'Usuario no encontrado'}), 404
    if user.username == 'admin':
        return jsonify({'status': 'error', 'msg': 'No se puede modificar el administrador principal'}), 400
    
    user.status = data['status']
    db.session.commit()
    return jsonify({'status': 'ok'}), 200

# ==================== ENDPOINTS DE PEDIDOS ====================

@app.route('/api/orders', methods=['GET'])
def get_orders():
    if not check_role(['vendedor', 'analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    pedidos = Pedido.query.order_by(Pedido.id.desc()).limit(15).all()
    resultado = [{
        'id': p.id, # Retorna el ID para permitir edición
        'fecha': p.fecha,
        'producto': p.producto,
        'zona': p.zona,
        'cantidad': p.cantidad,
        'precio_uni': p.precio_uni,
        'total': p.total
    } for p in pedidos]
    return jsonify(resultado)

@app.route('/api/orders', methods=['POST'])
def add_order():
    if not check_role(['vendedor', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    data = request.json
    required = ['fecha', 'producto', 'zona', 'cantidad', 'precio_uni']
    if not all(k in data for k in required):
        return jsonify({'status': 'error', 'msg': 'Faltan campos requeridos'}), 400
        
    try:
        total = round(int(data['cantidad']) * float(data['precio_uni']), 2)
        nuevo_pedido = Pedido(
            fecha=data['fecha'],
            producto=data['producto'],
            zona=data['zona'],
            cantidad=int(data['cantidad']),
            precio_uni=float(data['precio_uni']),
            total=total
        )
        db.session.add(nuevo_pedido)
        db.session.commit()
        return jsonify({'status': 'ok', 'total': total}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'msg': str(e)}), 500

@app.route('/api/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    if not check_role(['vendedor', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    data = request.json
    pedido = db.session.get(Pedido, order_id)
    if not pedido:
        return jsonify({'status': 'error', 'msg': 'Pedido no encontrado'}), 404
        
    try:
        pedido.fecha = data['fecha']
        pedido.producto = data['producto']
        pedido.zona = data['zona']
        pedido.cantidad = int(data['cantidad'])
        pedido.precio_uni = float(data['precio_uni'])
        pedido.total = round(pedido.cantidad * pedido.precio_uni, 2)
        db.session.commit()
        return jsonify({'status': 'ok', 'total': pedido.total}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'msg': str(e)}), 500

# ==================== ENDPOINTS DE ANALÍTICA (SQL) ====================

@app.route('/api/top_products', methods=['GET'])
def top_products():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    pedidos = Pedido.query.all()
    if not pedidos:
        return jsonify({})
        
    res = {}
    for p in pedidos:
        res[p.producto] = round(res.get(p.producto, 0.0) + p.total, 2)
    res_sorted = {k: v for k, v in sorted(res.items(), key=lambda item: item[1], reverse=True)}
    return jsonify(res_sorted)

@app.route('/api/sales_by_month', methods=['GET'])
def sales_by_month():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    pedidos = Pedido.query.all()
    if not pedidos:
        return jsonify({})
        
    res = {}
    for p in pedidos:
        mes = p.fecha[:7] # YYYY-MM
        res[mes] = round(res.get(mes, 0.0) + p.total, 2)
    res_sorted = {k: res[k] for k in sorted(res.keys())}
    return jsonify(res_sorted)

@app.route('/api/sales_by_zone', methods=['GET'])
def sales_by_zone():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    
    pedidos = Pedido.query.all()
    if not pedidos:
        return jsonify({})
        
    res = {}
    for p in pedidos:
        res[p.zona] = round(res.get(p.zona, 0.0) + p.total, 2)
    res_sorted = {k: v for k, v in sorted(res.items(), key=lambda item: item[1], reverse=True)}
    return jsonify(res_sorted)

# ==================== ENDPOINT DE RESPALDOS (SQL) ====================

@app.route('/api/backup', methods=['POST'])
def backup():
    if not check_role(['admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Admin)'}), 403
    
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = 'backups'
    os.makedirs(backup_dir, exist_ok=True)
    
    db_path = os.path.join(app.instance_path, 'produblock.db')
    backup_path = f"{backup_dir}/produblock_{now}.db"
    
    try:
        shutil.copy(db_path, backup_path)
        return jsonify({'status': 'ok', 'file': backup_path}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'msg': str(e)}), 500

# Serve static frontend files
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
