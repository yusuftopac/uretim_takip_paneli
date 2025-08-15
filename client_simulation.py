import socket
import time
import random
import json
from datetime import datetime

HOST = '127.0.0.1'
PORT = 5000

# ---- AĞIRLIKLI OLASILIK: FAIL oranını burada ayarla ----
FAIL_RATE = 0.03  # %3 FAIL (istersen 0.01 = %1, 0.05 = %5 yapabilirsin)

def generate_random_data():
    status = "FAIL" if random.random() < FAIL_RATE else "PASS"
    return {
        "status": status,
        "machine_id": random.choice(["A1", "A2", "A3"]),  # makine dağılımı aynı kalsın
        "product_id": f"P{random.randint(100, 999)}",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def start_simulation():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((HOST, PORT))
    print("[+] Simülasyon bağlantısı kuruldu")

    while True:
        data = generate_random_data()
        json_data = json.dumps(data)
        s.sendall(json_data.encode())
        print(f"[VERİ GÖNDERİLDİ] → {data}")
        time.sleep(2)  # her 2 saniyede bir üretim
       
if __name__ == "__main__":
    start_simulation()