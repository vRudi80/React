import React, { useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import './App.css';

// ⚠️ IDE ÍRD A SZERVERED CÍMÉT (pl. https://api.szervered.hu)
const BACKEND_URL = "https://react-ideas-backend.onrender.com"; 

function App() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/records`);
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error("Hiba a letöltésnél:", err);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSave = async () => {
    if (!value) return alert("Kérlek adj meg egy értéket!");
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: parseFloat(value) })
      });

      if (res.ok) {
        setValue('');
        fetchRecords();
      }
    } catch (err) {
      alert("Hiba a mentés során!");
    }
  };

 return (
  <div className="app-wrapper">
    <header>
      <h1>Rezsi Nyilvántartó</h1>
      <p>Fogyasztás követése okosan</p>
    </header>

    <main>
      <section className="card">
        <h2>Új adat rögzítése</h2>
        <div className="input-group">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Áram">⚡ Áram (kWh)</option>
            <option value="Víz">💧 Víz (m³)</option>
            <option value="Gáz">🔥 Gáz (m³)</option>
          </select>
          <input 
            type="number" 
            placeholder="Mérőóra állása" 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
          />
          <button className="btn-primary" onClick={handleSave}>Rögzítés</button>
        </div>
      </section>

      <section className="list-section">
        <h3>Legutóbbi mérések</h3>
        <div className="records-grid">
          {records.map((rec: any) => (
            <div key={rec.Id} className={`record-item ${rec.Type}`}>
              <div className="record-info">
                <span className="record-type">
                   {rec.Type === 'Áram' ? '⚡' : rec.Type === 'Víz' ? '💧' : '🔥'} {rec.Type}
                </span>
                <span className="record-date">{rec.FormattedDate}</span>
              </div>
              <div className="record-value">
                {rec.Value} <small>{rec.Type === 'Áram' ? 'kWh' : 'm³'}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  </div>
);
}

export default App;
