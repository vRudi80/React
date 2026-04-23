import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState('Áram'); // Alapértelmezett érték
  const [value, setValue] = useState('');

  // Adatok betöltése
  const fetchRecords = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/records');
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error("Hiba a letöltéskor:", err);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  // Mentés funkció
  const handleSave = async () => {
    if (!value) return alert("Írj be egy értéket!");

    try {
      await fetch('http://localhost:4000/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: parseFloat(value) })
      });
      setValue(''); // Mező ürítése
      fetchRecords(); // Lista frissítése
    } catch (err) {
      alert("Hiba a mentés során!");
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Rezsi Nyilvántartó</h1>
      </header>

      <div className="card">
        <h2>Új mérés rögzítése</h2>
        <div className="input-group">
          <label>Típus:</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Áram">⚡ Áram (kWh)</option>
            <option value="Víz">💧 Víz (m³)</option>
            <option value="Gáz">🔥 Gáz (m³)</option>
          </select>

          <label>Mérőóra állása:</label>
          <input 
            type="number" 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
            placeholder="0.00"
          />

          <button className="btn-primary" onClick={handleSave}>Rögzítés</button>
        </div>
      </div>

      <div className="list">
        {records.map(rec => (
          <div key={rec.id} className="record-item">
            <div className="details">
              <strong>{rec.type}</strong>: {rec.value} 
              <small style={{display: 'block', color: '#888'}}>{rec.formatted_date}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
