from flask import Flask, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd, os, datetime, shutil

app = Flask(__name__)

# --- Simple user store (CSV) ---
USERS_FILE = 'users.csv'
recreate = False
if not os.path.exists(USERS_FILE) or os.path.getsize(USERS_FILE) <= 24:
    recreate = True
else:
    try:
        df_test = pd.read_csv(USERS_FILE)
        if 'role' not in df_test.columns:
            recreate = True
    except:
        recreate = True

if recreate:
    admin_hash = generate_password_hash('admin123')
    vendedor_hash = generate_password_hash('vendedor123')
    analista_hash = generate_password_hash('analista123')
    users_data = [
        {'username': 'admin', 'password_hash': admin_hash, 'role': 'admin'},
        {'username': 'vendedor1', 'password_hash': vendedor_hash, 'role': 'vendedor'},
        {'username': 'analista1', 'password_hash': analista_hash, 'role': 'analista'}
    ]
    pd.DataFrame(users_data).to_csv(USERS_FILE, index=False)

def load_users():
    return pd.read_csv(USERS_FILE)

def save_user(username, pwd_hash, role='vendedor'):
    df = load_users()
    new_row = pd.DataFrame([{'username': username, 'password_hash': pwd_hash, 'role': role}])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(USERS_FILE, index=False)

# --- Helper to verify permissions ---
def check_role(allowed_roles):
    # Control de seguridad: Validar rol enviado en cabecera HTTP
    role = request.headers.get('X-User-Role')
    if not role or role not in allowed_roles:
        return False
    return True

# --- Auth endpoint ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    users = load_users()
    row = users[users['username']==data['username']]
    if not row.empty and check_password_hash(row.iloc[0]['password_hash'], data['password']):
        return jsonify({'status':'ok', 'role': row.iloc[0]['role']}), 200
    return jsonify({'status':'error','msg':'Invalid credentials'}), 401

# --- Register endpoint (for prototype) ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if pd.read_csv(USERS_FILE)['username'].str.contains(data['username']).any():
        return jsonify({'status':'error','msg':'User exists'}), 400
    pwd_hash = generate_password_hash(data['password'])
    save_user(data['username'], pwd_hash, data.get('role', 'vendedor'))
    return jsonify({'status':'ok'}), 201

# --- Data file setup ---
DATA_FILE = 'ventas_pedidos.csv'

def load_data_safe():
    # Inicializa el archivo vacío con cabeceras si no existe o está dañado
    if not os.path.exists(DATA_FILE) or os.path.getsize(DATA_FILE) <= 39:
        pd.DataFrame(columns=['fecha', 'producto', 'zona', 'cantidad', 'precio_uni', 'total']).to_csv(DATA_FILE, index=False)
        return pd.DataFrame(columns=['fecha', 'producto', 'zona', 'cantidad', 'precio_uni', 'total'])
    try:
        return pd.read_csv(DATA_FILE)
    except:
        return pd.DataFrame(columns=['fecha', 'producto', 'zona', 'cantidad', 'precio_uni', 'total'])

# Inicializar en el arranque
load_data_safe()

@app.route('/api/upload', methods=['POST'])
def upload():
    f = request.files['file']
    f.save(DATA_FILE)
    return jsonify({'status':'ok'}), 200

# --- EDA endpoints (simple aggregates) ---
@app.route('/api/top_products', methods=['GET'])
def top_products():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Analista o Admin)'}), 403
    df = load_data_safe()
    if df.empty:
        return jsonify({})
    res = df.groupby('producto')['total'].sum().sort_values(ascending=False).to_dict()
    return jsonify(res)

@app.route('/api/sales_by_month', methods=['GET'])
def sales_by_month():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Analista o Admin)'}), 403
    df = load_data_safe()
    if df.empty:
        return jsonify({})
    df['fecha'] = pd.to_datetime(df['fecha'])
    df['mes'] = df['fecha'].dt.to_period('M').astype(str)
    res = df.groupby('mes')['total'].sum().sort_index().to_dict()
    return jsonify(res)

@app.route('/api/sales_by_zone', methods=['GET'])
def sales_by_zone():
    if not check_role(['analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Analista o Admin)'}), 403
    df = load_data_safe()
    if df.empty:
        return jsonify({})
    res = df.groupby('zona')['total'].sum().sort_values(ascending=False).to_dict()
    return jsonify(res)

# --- Register and Get orders ---
@app.route('/api/orders', methods=['GET'])
def get_orders():
    if not check_role(['vendedor', 'analista', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado'}), 403
    df = load_data_safe()
    if df.empty:
        return jsonify([])
    # Retorna las últimas 15 órdenes de más reciente a más antigua
    recent = df.tail(15).iloc[::-1].to_dict(orient='records')
    return jsonify(recent)

@app.route('/api/orders', methods=['POST'])
def add_order():
    if not check_role(['vendedor', 'admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Vendedor o Admin)'}), 403
    
    data = request.json
    required = ['fecha', 'producto', 'zona', 'cantidad', 'precio_uni']
    if not all(k in data for k in required):
        return jsonify({'status': 'error', 'msg': 'Faltan campos requeridos'}), 400
        
    try:
        df = load_data_safe()
        total = round(float(data['cantidad']) * float(data['precio_uni']), 2)
        new_order = pd.DataFrame([{
            'fecha': data['fecha'],
            'producto': data['producto'],
            'zona': data['zona'],
            'cantidad': int(data['cantidad']),
            'precio_uni': float(data['precio_uni']),
            'total': total
        }])
        df = pd.concat([df, new_order], ignore_index=True)
        df.to_csv(DATA_FILE, index=False)
        return jsonify({'status': 'ok', 'total': total}), 201
    except Exception as e:
        return jsonify({'status': 'error', 'msg': str(e)}), 500

# --- Backup endpoint ---
@app.route('/api/backup', methods=['POST'])
def backup():
    if not check_role(['admin']):
        return jsonify({'status': 'error', 'msg': 'Acceso denegado (Requiere rol Admin)'}), 403
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = 'backups'
    os.makedirs(backup_dir, exist_ok=True)
    shutil.copy(DATA_FILE, f"{backup_dir}/ventas_{now}.csv")
    return jsonify({'status':'ok','file':f'backups/ventas_{now}.csv'}), 200


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
