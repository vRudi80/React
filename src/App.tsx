import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const BACKEND_URL = "https://react-ideas-backend.onrender.com";

function App() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('Áram'); // Alapértelmezett szűrő az Áram

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/records`);
      const data = await res.json();
      setRecords(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSave = async () => {
    if (!value || !date) return alert("Minden mezőt tölts ki!");
    try {
      await fetch(`${BACKEND_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: parseFloat(value), date })
      });
      setValue('');
      fetchRecords();
    } catch (err) {
      alert("Hiba történt a mentés során!");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Biztosan törölni szeretnéd ezt a bejegyzést?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/records/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchRecords(); // Frissítjük a listát a törlés után
      }
    } catch (err) {
      alert("Hiba történt a törlés során!");
    }
  };

  // Csak a szűrt rekordok megjelenítése
  const filteredRecords = records.filter((r: any) => r.Type === filter);

  // Grafikon adatok (mindig az aktuális szűrő alapján)
  const chartData = [...filteredRecords].reverse().map((r: any) => ({
    datum: r.FormattedDate.split(' ')[0],
    ertek: parseFloat(r.Value)
  }));

  return (
    <div className="app-wrapper">
      <header>
        <h1>Rezsi Nyilvántartó</h1>
      </header>

      <section className="card main-card">
        <h2>Új mérés rögzítése</h2>
        <div className="input-row">
          <div className="input-field">
            <label>Típus</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Áram">⚡ Áram</option>
              <option value="Víz">💧 Víz</option>
              <option value="Gáz">🔥 Gáz</option>
            </select>
          </div>
          <div className="input-field">
            <label>Dátum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="input-field">
            <label>Mérőóra állása</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave}>Adat mentése</button>
      </section>

      {/* SZŰRŐK */}
      <div className="filter-bar">
        {['Áram', 'Víz', 'Gáz'].map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {/* GRAFIKON SZEKCIÓ */}
      <section className="card chart-card">
        <h2>{filter} fogyasztási trend</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="datum" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip 
                contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} 
                itemStyle={{color: '#3b82f6'}}
              />
              <Line 
                type="monotone" 
                dataKey="ertek" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{r: 5, fill: '#3b82f6'}} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* LISTA SZEKCIÓ */}
      <section className="list-section">
        <div className="records-grid">
          {filteredRecords.map((rec: any) => (
            <div key={rec.Id} className={`record-item ${rec.Type}`}>
              <div className="record-info">
                <span className="record-type">
                  {rec.Type === 'Áram' ? '⚡' : rec.Type === 'Víz' ? '💧' : '🔥'} {rec.Type}
                </span>
                <span className="record-date">📅 {rec.FormattedDate}</span>
              </div>
              <div className="record-value-container">
                <div className="val-box">
                  <span className="record-value">{rec.Value}</span>
                  <span className="record-unit">{rec.Type === 'Áram' ? 'kWh' : 'm³'}</span>
                </div>
                <button className="btn-delete" onClick={() => handleDelete(rec.Id)}>Törlés</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
