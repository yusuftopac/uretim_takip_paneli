import React, { useEffect, useState } from 'react';
import './styles.css';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

function StatusPill({ status }) {
  const ok = String(status).toUpperCase() === 'PASS';
  return (
    <span className={`status-pill ${ok ? 'status-pill--pass' : 'status-pill--fail'}`}>
      <span className={`status-dot ${ok ? 'dot--pass' : 'dot--fail'}`} />
      {ok ? 'PASS' : 'FAIL'}
    </span>
  );
}

function formatTS(ts) {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T'));
  if (isNaN(d)) return ts;
  return d.toLocaleString('tr-TR');
}

/* Özel Tooltip (Pie) */
function PieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="tip">
      <div className="tip-title">PASS/FAIL</div>
      <div className="tip-row">
        <span className={`dot ${String(p.name).toLowerCase()}`} />
        <span className="tip-name">{p.name}</span>
        <span className="tip-val">{p.value}</span>
      </div>
    </div>
  );
}

/* Özel Tooltip (Bar) */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const pass = payload.find(x => x.dataKey === 'pass');
  const fail = payload.find(x => x.dataKey === 'fail');
  return (
    <div className="tip">
      <div className="tip-title">Zaman: {label}</div>
      <div className="tip-row">
        <span className="dot pass" /><span className="tip-name">PASS</span>
        <span className="tip-val">{pass?.value ?? 0}</span>
      </div>
      <div className="tip-row">
        <span className="dot fail" /><span className="tip-name">FAIL</span>
        <span className="tip-val">{fail?.value ?? 0}</span>
      </div>
    </div>
  );
}

function buildTimeSeries(history) {
  const map = new Map();
  [...history].reverse().forEach(item => {
    const d = new Date(String(item.timestamp).replace(' ', 'T'));
    const label = isNaN(d)
      ? String(item.timestamp)
      : d.toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

    if (!map.has(label)) map.set(label, { time: label, pass: 0, fail: 0 });
    const bucket = map.get(label);
    if (String(item.status).toUpperCase() === 'PASS') bucket.pass += 1;
    else bucket.fail += 1;
  });
  return Array.from(map.values());
}

// "YYYY-MM-DDTHH:MM" -> "YYYY-MM-DD HH:MM:SS"
function toDbTs(dtLocal) {
  if (!dtLocal) return '';
  return dtLocal.replace('T', ' ') + ':00';
}

function App() {
  const [historyData, setHistoryData] = useState([]);
  const [realtimeData, setRealtimeData] = useState(null);

  const [machines, setMachines] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [limit, setLimit] = useState(10);

  // Zaman filtresi
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');

  // Hızlı aralık + aktif seçim
  const [activeQuick, setActiveQuick] = useState(null);
  const setQuickRange = (minutes) => {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const toLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setStartLocal(toLocal(start));
    setEndLocal(toLocal(end));
    setActiveQuick(minutes);
  };

  const onStartChange = (v) => { setStartLocal(v); setActiveQuick(null); };
  const onEndChange = (v) => { setEndLocal(v); setActiveQuick(null); };

  // Tema
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('theme-dark');
    else root.classList.remove('theme-dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Son görülen ID (flash)
  const [lastFlashId, setLastFlashId] = useState(null);

  // Pie aktif dilim
  const [activeSlice, setActiveSlice] = useState(0);

  // 🔎 Tablo arama
  const [search, setSearch] = useState('');

  // Makineler & Ürünler
  useEffect(() => {
    fetch('http://127.0.0.1:8000/machines')
      .then(r => r.json())
      .then(setMachines)
      .catch(e => console.error('Machines alınamadı:', e));

    fetch('http://127.0.0.1:8000/products')
      .then(r => r.json())
      .then(setProducts)
      .catch(e => console.error('Products alınamadı:', e));
  }, []);

  // History (limit + filtreler + zaman)
  useEffect(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (selectedMachine) params.append('machine_id', selectedMachine);
    if (selectedProduct) params.append('product_id', selectedProduct);
    if (startLocal) params.append('start', toDbTs(startLocal));
    if (endLocal) params.append('end', toDbTs(endLocal));

    fetch(`http://127.0.0.1:8000/history?${params.toString()}`)
      .then(r => r.json())
      .then(setHistoryData)
      .catch(e => console.error('History verisi alınamadı:', e));
  }, [limit, selectedMachine, selectedProduct, startLocal, endLocal]);

  // Realtime (filtreler + zaman)
  useEffect(() => {
    const tick = () => {
      const params = new URLSearchParams();
      if (selectedMachine) params.append('machine_id', selectedMachine);
      if (selectedProduct) params.append('product_id', selectedProduct);
      if (startLocal) params.append('start', toDbTs(startLocal));
      if (endLocal) params.append('end', toDbTs(endLocal));

      const url = params.toString()
        ? `http://127.0.0.1:8000/realtime?${params.toString()}`
        : 'http://127.0.0.1:8000/realtime';

      fetch(url)
        .then(r => r.json())
        .then(data => {
          setRealtimeData(data);
          if (data && data.id) setLastFlashId(data.id);
        })
        .catch(e => console.error('Realtime verisi alınamadı:', e));
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [selectedMachine, selectedProduct, startLocal, endLocal]);

  // Özetler ve grafik verileri
  const total = historyData.length;
  const passCount = historyData.filter(r => String(r.status).toUpperCase() === 'PASS').length;
  const failCount = historyData.filter(r => String(r.status).toUpperCase() === 'FAIL').length;
  const yieldRate = total ? ((passCount / total) * 100).toFixed(1) : 0;

  const pct = (num, den) => (den ? ((num / den) * 100).toFixed(1) : '0.0');
  const passPct = pct(passCount, total);
  const failPct = pct(failCount, total);

  const pieData = [
    { name: 'PASS', value: passCount },
    { name: 'FAIL', value: failCount }
  ];
  const timeSeries = buildTimeSeries(historyData);
  const hasData = total > 0;

  // CSV ve ortak param inşası
  const buildParams = () => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (selectedMachine) params.append('machine_id', selectedMachine);
    if (selectedProduct) params.append('product_id', selectedProduct);
    if (startLocal) params.append('start', toDbTs(startLocal));
    if (endLocal) params.append('end', toDbTs(endLocal));
    return params;
  };
  const downloadCsv = () => {
    const params = buildParams();
    const url = `http://127.0.0.1:8000/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  const chipStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: 16,
    border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
    background: active ? '#3b82f6' : '#f8fafc',
    color: active ? '#fff' : '#0f172a',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all .15s',
  });

  // Arama: tabloya yansıyacak satırlar
  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? historyData.filter(row => {
        const hay = `${row.id} ${row.status} ${row.machine_id} ${row.product_id} ${row.timestamp}`.toLowerCase();
        return hay.includes(q);
      })
    : historyData;

  // Anlık kart için accent (PASS/FAIL durumuna göre)
  const realtimeOk = realtimeData && String(realtimeData.status).toUpperCase() === 'PASS';
  const realtimeAccentClass = realtimeData
    ? (realtimeOk ? 'card--accent-success' : 'card--accent-danger')
    : 'card--accent';

  // ========== EK BİLGİLER için özetler (makine/ürün bazında) ==========
  const aggBy = (key) => {
    const map = {};
    historyData.forEach(r => {
      const k = r[key];
      if (!map[k]) map[k] = { pass: 0, fail: 0, total: 0 };
      const ok = String(r.status).toUpperCase() === 'PASS';
      if (ok) map[k].pass += 1; else map[k].fail += 1;
      map[k].total += 1;
    });
    return map;
  };

  const byMachine = aggBy('machine_id');
  const byProduct = aggBy('product_id');

  const topFailMachine = Object.entries(byMachine).sort((a,b)=> (b[1].fail)-(a[1].fail))[0];
  const topFailProduct = Object.entries(byProduct).sort((a,b)=> (b[1].fail)-(a[1].fail))[0];

  const activeFilterText = [
    selectedMachine ? `Makine: ${selectedMachine}` : 'Makine: Tümü',
    selectedProduct ? `Ürün: ${selectedProduct}` : 'Ürün: Tümü',
    startLocal || endLocal
      ? `Aralık: ${startLocal ? startLocal.replace('T',' ') : '…'}  →  ${endLocal ? endLocal.replace('T',' ') : '…'}`
      : 'Aralık: Tümü'
  ].join(' | ');

  return (
    <div className="page">
      {/* Üst Bar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand__logo">🏭</div>
          <div className="brand__name">Üretim Paneli</div>
        </div>
        <div className="topbar__right" style={{ display:'flex', alignItems:'center', gap:12 }}>
          <small>Tema</small>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Tema değiştir"
            title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      <div className="container">
        {/* Başlık */}
        <div className="header">
          <h1 className="title">
            Üretim Takip Paneli
            <span style={{marginLeft:8, fontSize:12, color:'var(--muted)'}}></span>
          </h1>
        </div>

        {/* ÜST 3 KART */}
        <div className="grid-3">
          {/* 1) Anlık Veri */}
          <div className={`card card--tight card--accent ${realtimeAccentClass}`}>
            <div className="card__header">
              <div className="card__icon">📡</div>
              <div>
                <div className="card__title">Anlık Veri</div>
                <div className="card__subtitle">Canlı üretim akışı</div>
              </div>
            </div>

            <div className="card__body">
              {realtimeData && realtimeData.id ? (
                <div className="kv-row">
                  <div className="kv-label">Durum:</div>
                  <div className="kv-value">
                    <StatusPill status={realtimeData.status} />
                    <span className={String(realtimeData.status).toUpperCase()==='PASS' ? 'kv-ok' : 'kv-bad'}>
                      {String(realtimeData.status).toUpperCase()==='PASS' ? 'Uygun' : 'Hatalı'}
                    </span>
                  </div>

                  <div className="kv-label">Makine:</div>
                  <div className="kv-value">{realtimeData.machine_id}</div>

                  <div className="kv-label">Ürün:</div>
                  <div className="kv-value">{realtimeData.product_id}</div>

                  <div className="kv-label">Zaman:</div>
                  <div className="kv-value">{formatTS(realtimeData.timestamp)}</div>
                </div>
              ) : (
                <p className="m0">Yükleniyor...</p>
              )}
            </div>
          </div>

          {/* 2) Filtreler */}
          <div className="card card--tight card--accent">
            <div className="card__header">
              <div className="card__icon">🧭</div>
              <div>
                <div className="card__title">Filtreler</div>
                <div className="card__subtitle">Görünüm seçenekleri</div>
              </div>
            </div>

            <div className="filters-column">
              <div className="kv-label">Makine</div>
              <div className="kv-value">
                <select
                  value={selectedMachine}
                  onChange={e => setSelectedMachine(e.target.value)}
                >
                  <option value="">Tümü</option>
                  {machines.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="kv-label">Ürün</div>
              <div className="kv-value">
                <select
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                >
                  <option value="">Tümü</option>
                  {products.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="kv-label">Kayıt</div>
              <div className="kv-value">
                <select
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                >
                  <option value={10}>Son 10</option>
                  <option value={25}>Son 25</option>
                  <option value={50}>Son 50</option>
                  <option value={100}>Son 100</option>
                  <option value={200}>Son 200</option>
                  <option value={300}>Son 300</option>
                  <option value={500}>Son 500</option>
                  <option value={1000}>Son 1000</option>
                  <option value={2000}>Son 2000</option>
                </select>
              </div>

              <div className="kv-label">Başlangıç</div>
              <div className="kv-value">
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={e => onStartChange(e.target.value)}
                />
              </div>

              <div className="kv-label">Bitiş</div>
              <div className="kv-value">
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={e => onEndChange(e.target.value)}
                />
              </div>

              <div className="kv-label">Hızlı</div>
              <div className="kv-value" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { label: 'Son 15 dk', minutes: 15 },
                  { label: 'Son 1 saat', minutes: 60 },
                  { label: 'Bugün', minutes: 1440 },
                ].map(p => (
                  <button
                    key={p.minutes}
                    onClick={() => setQuickRange(p.minutes)}
                    style={chipStyle(activeQuick === p.minutes)}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={downloadCsv}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #0ea5e9',
                    background: '#0ea5e9',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Aktif filtrelerle CSV indir"
                >
                  CSV indir
                </button>
              </div>
            </div>
          </div>

          {/* 3) PASS/FAIL Oranı */}
          <div className="card card--tight card--accent-success">
            <div className="card__header">
              <div className="card__icon">🎯</div>
              <div>
                <div className="card__title">PASS/FAIL Oranı</div>
                <div className="card__subtitle">Kalite dağılımı</div>
              </div>
            </div>

            {hasData ? (
              <>
                <div className="chart-200">
                  <ResponsiveContainer>
                    <PieChart>
                      <defs>
                        <linearGradient id="gradPass" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#86efac" />
                          <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                        <linearGradient id="gradFail" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fca5a5" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>

                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        innerRadius={48}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={2}
                        animationDuration={700}
                        activeIndex={activeSlice}
                        onMouseEnter={(_, idx) => setActiveSlice(idx)}
                        onMouseLeave={() => setActiveSlice(0)}
                        label={({ name, value }) => `${name} ${pct(value, total)}%`}
                      >
                        <Cell fill="url(#gradPass)" />
                        <Cell fill="url(#gradFail)" />
                      </Pie>

                      <text
                        x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                        className="yield-center"
                        style={{ fontWeight: 800, fontSize: 22 }}
                      >
                        %{yieldRate}
                      </text>

                      <Tooltip content={<PieTooltip />} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* ▶️ EK BİLGİLER BLOĞU */}
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-icon ok">✅</div>
                    <div className="info-text">
                      <div className="info-title">Başarılı</div>
                      <div className="info-sub">
                        Toplam <strong>{passCount}</strong> kayıt • %{passPct}
                      </div>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon bad">❌</div>
                    <div className="info-text">
                      <div className="info-title">Başarısız</div>
                      <div className="info-sub">
                        Toplam <strong>{failCount}</strong> kayıt • %{failPct}
                      </div>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon">🏭</div>
                    <div className="info-text">
                      <div className="info-title">En çok hata veren makine</div>
                      <div className="info-sub">
                        {topFailMachine
                          ? <><strong>{topFailMachine[0]}</strong> • {topFailMachine[1].fail} hata</>
                          : 'Veri yok'}
                      </div>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon">📦</div>
                    <div className="info-text">
                      <div className="info-title">En çok hata veren ürün</div>
                      <div className="info-sub">
                        {topFailProduct
                          ? <><strong>{topFailProduct[0]}</strong> • {topFailProduct[1].fail} ürün</>
                          : 'Veri yok'}
                      </div>
                    </div>
                  </div>

                  <div className="info-item span-2">
                    <div className="info-icon">🔎</div>
                    <div className="info-text">
                      <div className="info-title">Aktif filtre</div>
                      <div className="info-sub">{activeFilterText}</div>
                    </div>
                  </div>
                </div>
                {/* ◀️ EK BİLGİLER BLOĞU SONU */}
              </>
            ) : <p>Veri yok</p>}
          </div>

          {/* ALT SATIR: Zaman Serisi */}
          <div className="card span-all card--tight card--accent">
            <div className="card__header">
              <div className="card__icon">📈</div>
              <div>
                <div className="card__title">Zaman Serisi (Son {limit} Kayıt)</div>
                <div className="card__subtitle">Son aktiviteler</div>
              </div>
            </div>

            {hasData ? (
              <div className="chart-260">
                <ResponsiveContainer>
                  <BarChart
                    data={timeSeries}
                    margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                  >
                    <defs>
                      <linearGradient id="gradPassBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#86efac" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                      <linearGradient id="gradFailBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fca5a5" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis
                      allowDecimals={false}
                      domain={[0, 'dataMax + 2']}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Legend iconType="circle" verticalAlign="bottom" align="center" wrapperStyle={{ bottom: 0 }}/>
                    <Bar
                      dataKey="pass"
                      stackId="a"
                      fill="url(#gradPassBar)"
                      name="PASS"
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="fail"
                      stackId="a"
                      fill="url(#gradFailBar)"
                      name="FAIL"
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p>Veri yok</p>}
          </div>
        </div>

        {/* Tablo */}
        <div className="card card--accent">
          <div className="table-tools">
            <h2 className="m0">Kayıtlar</h2>
            <div className="table-actions">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tabloda ara: ID, Makine, Ürün, PASS/FAIL..."
                className="search-input"
              />
              <span className="muted">{visibleRows.length} / {historyData.length}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Durum</th>
                  <th>Makine</th>
                  <th>Ürün</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(item => {
                  const ok = String(item.status).toUpperCase() === 'PASS';
                  return (
                    <tr
                      key={item.id}
                      className={`${ok ? 'row--pass' : 'row--fail'} ${item.id === lastFlashId ? 'flash' : ''}`}
                      title={ok ? 'Uygun' : 'Hatalı'}
                    >
                      <td>{item.id}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td>{item.machine_id}</td>
                      <td>{item.product_id}</td>
                      <td>{formatTS(item.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
