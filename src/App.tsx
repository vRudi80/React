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
  const [viewMode, setViewMode] = useState('daily');

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

  // ADATOK ELŐKÉSZÍTÉSE ÉS SORRENDEZÉSE
  const currentTypeRecords = records
    .filter((r: any) => r.Type === filter)
    .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());

  // 1. Napi adatok (Óraállás)
  const dailyData = [...currentTypeRecords].map((r: any) => ({
    label: r.FormattedDate.split(' ')[0],
    ertek: parseFloat(r.Value)
  }));

  // 2. JAVÍTOTT HAVI FOGYASZTÁS LOGIKA
  const getMonthlyConsumption = () => {
    const consumptionByMonth: { [key: string]: number } = {};

    // Végig megyünk az összes sorrendbe rakott rekordon
    for (let i = 1; i < currentTypeRecords.length; i++) {
      const current = currentTypeRecords[i];
      const prev = currentTypeRecords[i - 1];
      
      const currentVal = parseFloat(current.Value);
      const prevVal = parseFloat(prev.Value);
      const monthKey = current.FormattedDate.substring(0, 7); // A fogyasztást ahhoz a hónaphoz írjuk, amikor mértük

      // Ha az új állás nagyobb vagy egyenlő, mint az előző, hozzáadjuk a különbséget
      if (currentVal >= prevVal) {
        const diff = currentVal - prevVal;
        consumptionByMonth[monthKey] = (consumptionByMonth[monthKey] || 0) + diff;
      } else {
        // ÓRACSERE ESETÉN: 
        // Itt a különbséget nem tudjuk pontosan (hacsak nem rögzítetted a régi óra utolsó állását 0-val),
        // ezért ezt a negatív ugrást egyszerűen figyelmen kívül hagyjuk.
        // A számlálás a következő rögzítéstől indul újra a 0-ról.
        console.log(`Óracsere észlelve: ${prevVal} -> ${currentVal}`);
      }
    };

    // Átalakítás a grafikonnak megfelelő formátumba
    return Object.keys(consumptionByMonth).sort().map(month => ({
      honap: month,
      fogyasztas: Math.round(consumptionByMonth[month] * 100) / 100
    }));
  };

    const months = Object.keys(monthlyStats).sort();
    
    return months.map((month, i) => {
      const nextMonth = months[i + 1];
      let consumption = 0;

      if (nextMonth) {
        // Ha van következő hónap: Köv. hónap eleje - Ezen hónap eleje
        consumption = monthlyStats[nextMonth].first - monthlyStats[month].first;
      } else {
        // Ha ez az utolsó (aktuális) hónap: Utolsó állás - Hónap eleji állás
        consumption = monthlyStats[month].last - monthlyStats[month].first;
      }

      return {
        honap: month,
        fogyasztas: consumption > 0 ? Math.round(consumption * 100) / 100 : 0
      };
    });
  };

  const monthlyData = getMonthlyConsumption();

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
            <label>Óraállás</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave}>Mentés</button>
      </section>

      <div className="controls-bar">
        <div className="filter-buttons">
          {['Áram', 'Víz', 'Gáz'].map(f => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'Áram' ? '⚡ Áram' : f === 'Víz' ? '💧 Víz' : '🔥 Gáz'}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={viewMode === 'daily' ? 'active' : ''} onClick={() => setViewMode('daily')}>Napi (Állás)</button>
          <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi (Fogyasztás)</button>
        </div>
      </div>

      <section className="card chart-card">
        <h2>{filter} - {viewMode === 'daily' ? 'Mérőóra állása' : 'Havi fogyasztás'}</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            {viewMode === 'daily' ? (
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} />
                <Line type="monotone" dataKey="ertek" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} />
              </LineChart>
            ) : (
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="honap" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc' }} // Ez teszi világossá az alsó (fogyasztás) szöveget
                  labelStyle={{ color: '#fff', marginBottom: '4px', fontWeight: 'bold' }} // A dátum színe és stílusa
                  formatter={(value: any) => [`${value} ${filter === 'Áram' ? 'kWh' : 'm³'}`, 'fogyasztás']}
                />
                <Bar dataKey="fogyasztas" radius={[4, 4, 0, 0]}>
                   {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={filter === 'Áram' ? '#fbbf24' : filter === 'Víz' ? '#38bdf8' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      <section className="list-section">
        <div className="records-grid">
          {[...currentTypeRecords].reverse().map((rec: any) => (
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
