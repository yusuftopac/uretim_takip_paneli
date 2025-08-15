import socket
import sqlite3
import json

HOST = '127.0.0.1'
PORT = 5000

def save_to_db(data):
    conn = sqlite3.connect("production_data.db")
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO production_data (status, machine_id, product_id, timestamp)
        VALUES (?, ?, ?, ?)
    ''', (data['status'], data['machine_id'], data['product_id'], data['timestamp']))
    conn.commit()
    conn.close()
    print("[DB] Veri kaydedildi:", data)

def start_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind((HOST, PORT))
    s.listen()
    print(f"[+] TCP sunucusu başlatıldı: {HOST}:{PORT}")
    conn, addr = s.accept()
    print(f"[+] Bağlantı sağlandı: {addr}")

    while True:
        data = conn.recv(1024)
        if not data:
            break
        try:
            decoded = data.decode()
            json_data = json.loads(decoded)  # JSON veri çözümleniyor
            print(f"[VERİ ALINDI] → {json_data}")
            save_to_db(json_data)
        except Exception as e:
            print("[HATA] Geçersiz veri:", e)

    conn.close()
    s.close()

if __name__ == "__main__":
    start_server()