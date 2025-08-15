import sqlite3

# Veritabanına bağlan
conn = sqlite3.connect("production_data.db")
cursor = conn.cursor()

# Tablodaki tüm verileri sil
cursor.execute("DELETE FROM production_data;")

# ID sayacını sıfırla
cursor.execute("DELETE FROM sqlite_sequence WHERE name='production_data';")

conn.commit()
conn.close()

print(" production_data tablosu temizlendi ve ID sıfırlandı.")
