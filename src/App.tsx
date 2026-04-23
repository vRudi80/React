import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import './App.css';

const BACKEND_URL = "https://react-ideas-backend.onrender.com";

function App() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('daily'); // 'daily' vagy 'monthly'

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
    } catch (err) { alert("Hiba a mentés során!"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Biztosan törlöd?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/records/${id}`, { method: 'DELETE' });
      if (res.ok) fetchRecords();
    } catch (err) { alert("Hiba a törlés során!"); }
  };

  // ADATOK ELŐKÉSZÍTÉSE
  const currentTypeRecords = records
    .filter((r: any) => r.Type === filter)
    .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());

  // 1. Napi adatok a vonaldiagramhoz
  const dailyData = [...currentTypeRecords].map((r: any) => ({
    label: r.FormattedDate.split(' ')[0],
    ertek: parseFloat(r.Value)
  }));

  // 2. Havi fogyasztás kiszámítása (Első óraállások különbsége)
  const getMonthlyConsumption = () => {
    const monthlyFirsts: { [key: string]: number } = {};
    
    currentTypeRecords.forEach((r: any) => {
      const monthKey = r.FormattedDate.substring(0, 7); // "YYYY-MM"
      if (!monthlyFirsts[monthKey]) {
        monthlyFirsts[monthKey] = parseFloat(r.Value);
      }
    });

    const months = Object.keys(monthlyFirsts).sort();
    const consumptionData = [];

    for (let i = 1; i < months.length; i++) {
      const currentMonth = months[i];
      const prevMonth = months[i - 1];
      const consumption = monthlyFirsts[currentMonth] - monthlyFirsts[prevMonth];
      
      consumptionData.push({
        honap: currentMonth,
        fogyasztas: consumption > 0 ? consumption : 0 // Ne legyen negatív, ha óracsere volt
      });
    }
    return consumptionData;
  };

  const monthlyData = getMonthlyConsumption();

  return (
    <div className="app-wrapper">
      <header>
        <h1>Rezsi Nyilvántartó</h1>
      </header>

      {/* BEVITEL */}
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
            <label>Óraállás</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave}>Mentés</button>
      </section>

      {/* SZŰRŐK ÉS NÉZETVÁLTÓ */}
      <div className="controls-bar">
        <div className="filter-buttons">
          {['Áram', 'Víz', 'Gáz'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={viewMode === 'daily' ? 'active' : ''} onClick={() => setViewMode('daily')}>Napi (Állás)</button>
          <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi (Fogyasztás)</button>
        </div>
      </div>

      {/* GRAFIKON */}
      <section className="card chart-card">
        <h2>{filter} - {viewMode === 'daily' ? 'Mérőóra állása' : 'Havi fogyasztás'}</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            {viewMode === 'daily' ? (
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                <Line type="monotone" dataKey="ertek" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} />
              </LineChart>
            ) : (
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="honap" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                <Bar dataKey="fogyasztas" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                   {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={filter === 'Áram' ? '#fbbf24' : filter === 'Víz' ? '#38bdf8' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {viewMode === 'monthly' && monthlyData.length === 0 && (
          <p className="hint">Legalább két különböző hónap adata kell a fogyasztás számításához.</p>
        )}
      </section>

      {/* LISTA */}
      <section className="list-section">
        <div className="records-grid">
          {[...currentTypeRecords].reverse().map((rec: any) => (
            <div key={rec.Id} className={`record-item ${rec.Type}`}>
              <div className="record-info">
                <span className="record-type">{rec.Type}</span>
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
