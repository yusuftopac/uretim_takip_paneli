import sqlite3

def initialize_db():
    conn = sqlite3.connect("production_data.db")  # Veritabanı dosyası oluşturulurdm.
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS production_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT,
            machine_id TEXT,
            product_id TEXT,
            timestamp TEXT
        )
    ''')

    conn.commit()
    conn.close()
    print("✅ Veritabanı ve tablo başarıyla oluşturuldu.")

initialize_db()