
from flask import Flask, g, jsonify, request, render_template, redirect, url_for
import sqlite3, os

DB_PATH = 'meditrack.db'
app = Flask(__name__, static_folder='static', template_folder='templates')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH, check_same_thread=False)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exc):
    db = getattr(g, '_database', None)
    if db: db.close()

# API endpoints (same as before)
@app.route('/api/items', methods=['GET','POST'])
def items():
    db = get_db(); cur = db.cursor()
    if request.method == 'GET':
        q = request.args.get('q','').strip()
        tab = request.args.get('tab','').strip()
        if q:
            like = f"%{q}%"
            cur.execute("SELECT * FROM items WHERE name LIKE ? OR barcode LIKE ?", (like, like))
        elif tab == 'low':
            cur.execute("SELECT * FROM items WHERE stock <= low_stock_threshold")
        elif tab == 'expiring':
            cur.execute("SELECT * FROM items WHERE expires_on IS NOT NULL")
        else:
            cur.execute("SELECT * FROM items")
        rows = cur.fetchall()
        items = [{k: row[k] for k in row.keys()} for row in rows]
        return jsonify(items)
    data = request.json or {}
    required = ('name','stock')
    for r in required:
        if r not in data:
            return jsonify({'error': f'missing {r}'}), 400
    cur.execute("""INSERT INTO items (name,barcode,stock,dom,doe,low_stock_threshold,times_used,expires_on)
                   VALUES (?,?,?,?,?,?,?,?)""", (
        data.get('name'), data.get('barcode'), int(data.get('stock') or 0),
        data.get('dom'), data.get('doe'), int(data.get('low_stock_threshold') or 5),
        int(data.get('times_used') or 0), data.get('expires_on')
    ))
    db.commit()
    iid = cur.lastrowid
    cur.execute("SELECT * FROM items WHERE id=?", (iid,))
    r = cur.fetchone()
    return jsonify({k: r[k] for k in r.keys()}), 201

@app.route('/api/items/<int:iid>', methods=['GET','PUT','DELETE'])
def item_detail(iid):
    db = get_db(); cur = db.cursor()
    if request.method == 'GET':
        cur.execute("SELECT * FROM items WHERE id=?", (iid,))
        r = cur.fetchone()
        if not r: return jsonify({'error':'not found'}), 404
        return jsonify({k: r[k] for k in r.keys()})
    if request.method == 'PUT':
        data = request.json or {}
        fields=[]; vals=[]
        for k in ('name','barcode','stock','dom','doe','low_stock_threshold','times_used','expires_on'):
            if k in data:
                fields.append(f"{k}=?"); vals.append(data[k])
        if not fields: return jsonify({'error':'no fields'}), 400
        vals.append(iid)
        sql = f"UPDATE items SET {', '.join(fields)} WHERE id=?"
        cur.execute(sql, vals); db.commit()
        cur.execute("SELECT * FROM items WHERE id=?", (iid,)); r = cur.fetchone()
        return jsonify({k: r[k] for k in r.keys()})
    if request.method == 'DELETE':
        cur.execute("DELETE FROM items WHERE id=?", (iid,)); db.commit()
        return jsonify({'deleted': True})

# Page routes - separate pages per tab
@app.route('/')
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html', active='dashboard', show_search=False)

@app.route('/inventory')
def inventory():
    return render_template('inventory.html', active='inventory', show_search=True)

@app.route('/low-stock')
def low_stock():
    return render_template('low.html', active='low', show_search=True)

@app.route('/expiring')
def expiring():
    return render_template('expiring.html', active='expiring', show_search=True)

@app.route('/account')
def account():
    return render_template('account.html', active='account', show_search=False)

# convenience redirect for MediTrack brand click
@app.route('/brand')
def brand():
    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    if not os.path.exists(DB_PATH):
        print('Database not found. Run init_db.py to create meditrack.db.')
    app.run(debug=True)
