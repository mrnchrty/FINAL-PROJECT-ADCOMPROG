
import sqlite3, os
DB_PATH = 'meditrack.db'
if os.path.exists(DB_PATH):
    print('meditrack.db already exists. Remove it if you want to recreate.')
else:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT,
        stock INTEGER DEFAULT 0,
        dom TEXT,
        doe TEXT,
        low_stock_threshold INTEGER DEFAULT 5,
        times_used INTEGER DEFAULT 0,
        expires_on TEXT
    )''')
    sample = [
        ('Biogesic','111111',60,'2001-01-11','2002-02-22',5,12,'2025-11-15'),
        ('Paracetamol','222222',3,'2001-01-11','2002-02-22',5,30,'2025-11-01'),
        ('Amoxicillin','333333',15,'2001-01-11','2002-02-22',5,5,'2026-01-10'),
    ]
    c.executemany('INSERT INTO items (name,barcode,stock,dom,doe,low_stock_threshold,times_used,expires_on) VALUES (?,?,?,?,?,?,?,?)', sample)
    conn.commit(); conn.close()
    print('meditrack.db created with sample data.')
