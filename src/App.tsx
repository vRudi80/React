import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');

  const fetchRecords = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/records'); // Ide majd a Netlify-os backend URL kell!
      const data = await res.json();
      setRecords(data);
    } catch (err) { console.log(err); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSave = async () => {
    if (!value) return;
    await fetch('http://localhost:4000/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value: parseFloat(value) })
    });
    setValue('');
    fetchRecords();
  };

  return (
    <div className="container">
      <h1>Rezsi nyilvántartó app</h1>
      <div className="card">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Áram">⚡ Áram</option>
          <option value="Víz">💧 Víz</option>
          <option value="Gáz">🔥 Gáz</option>
        </select>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték..." />
        <button onClick={handleSave}>Rögzít</button>
      </div>

      <div className="list">
        {records.map((rec: any) => (
          <div key={rec.Id} className="record-item">
            <span>{rec.Type}: <strong>{rec.Value}</strong></span>
            <small>{rec.FormattedDate}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
