from typing import List, Optional, Tuple, Dict, Any
import csv
import io
import sqlite3

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

DB_PATH = "production_data.db"

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def build_where(
    machine_id: Optional[str],
    product_id: Optional[str],
    start: Optional[str],
    end: Optional[str],
) -> Tuple[str, List[Any]]:
    filters: List[str] = []
    params: List[Any] = []

    if machine_id:
        filters.append("machine_id = ?")
        params.append(machine_id)

    if product_id:
        filters.append("product_id = ?")
        params.append(product_id)

    if start:
        filters.append("timestamp >= ?")  # "YYYY-MM-DD HH:MM:SS"
        params.append(start)

    if end:
        filters.append("timestamp <= ?")
        params.append(end)

    where = f" WHERE {' AND '.join(filters)}" if filters else ""
    return where, params


# ---------- Listeler ----------
@app.get("/machines")
def get_machines() -> List[str]:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT machine_id FROM production_data ORDER BY machine_id"
        ).fetchall()
    return [r["machine_id"] for r in rows]


@app.get("/products")
def get_products() -> List[str]:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT product_id FROM production_data ORDER BY product_id"
        ).fetchall()
    return [r["product_id"] for r in rows]


# ---------- Geçmiş veri ----------
@app.get("/history")
def get_history(
    limit: int = Query(10, ge=1, le=2000),
    machine_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    start: Optional[str] = Query(None),  # "YYYY-MM-DD HH:MM:SS"
    end: Optional[str] = Query(None),    # "YYYY-MM-DD HH:MM:SS"
) -> List[Dict[str, Any]]:
    where, params = build_where(machine_id, product_id, start, end)
    query = f"SELECT * FROM production_data{where} ORDER BY id DESC LIMIT ?"

    with get_db_connection() as conn:
        rows = conn.execute(query, (*params, limit)).fetchall()

    return [dict(r) for r in rows]


# ---------- Anlık veri ----------
@app.get("/realtime")
def get_realtime(
    machine_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    start: Optional[str] = Query(None),  # "YYYY-MM-DD HH:MM:SS"
    end: Optional[str] = Query(None),    # "YYYY-MM-DD HH:MM:SS"
) -> Dict[str, Any]:
    where, params = build_where(machine_id, product_id, start, end)
    query = f"SELECT * FROM production_data{where} ORDER BY id DESC LIMIT 1"

    with get_db_connection() as conn:
        row = conn.execute(query, params).fetchone()

    return dict(row) if row else {}


# ---------- CSV dışa aktarım ----------
@app.get("/export")
def export_csv(
    limit: int = Query(1000, ge=1, le=100000),
    offset: int = Query(0, ge=0),
    machine_id: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    start: Optional[str] = Query(None),  # "YYYY-MM-DD HH:MM:SS"
    end: Optional[str] = Query(None),    # "YYYY-MM-DD HH:MM:SS"
):
    where, params = build_where(machine_id, product_id, start, end)
    query = (
        "SELECT id, status, machine_id, product_id, timestamp "
        "FROM production_data "
        f"{where} "
        "ORDER BY id DESC "
        "LIMIT ? OFFSET ?"
    )

    with get_db_connection() as conn:
        rows = conn.execute(query, (*params, limit, offset)).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "status", "machine_id", "product_id", "timestamp"])
    for r in rows:
        writer.writerow([r["id"], r["status"], r["machine_id"], r["product_id"], r["timestamp"]])

    output.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="production_export.csv"'}
    return StreamingResponse(output, media_type="text/csv", headers=headers)
