import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import './App.css';

const BACKEND_URL = "https://react-ideas-backend.onrender.com";
const GOOGLE_CLIENT_ID = "197361744572-ih728hq5jft3fqfd1esvktvrd8i97kcp.apps.googleusercontent.com";

function App() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('daily');

  const fetchRecords = async (token: string, targetId?: string) => {
    const idToFetch = targetId || viewingUserId || user?.sub;
    if (!idToFetch) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/records?userId=${idToFetch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setRecords(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchShares = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSharedWithMe(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        setUser({ ...decoded, token: savedToken });
        setViewingUserId(decoded.sub);
        fetchRecords(savedToken, decoded.sub);
        fetchShares(savedToken);
      } catch (e) { localStorage.removeItem('userToken'); }
    }
  }, []);

  const handleLoginSuccess = (credentialResponse: any) => {
    const token = credentialResponse.credential;
    const decoded: any = jwtDecode(token);
    setUser({ ...decoded, token: token });
    setViewingUserId(decoded.sub);
    localStorage.setItem('userToken', token);
    fetchRecords(token, decoded.sub);
    fetchShares(token);
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    localStorage.removeItem('userToken');
  };

  const handleShare = async () => {
    if (!shareEmail || !user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ sharedWithEmail: shareEmail.toLowerCase() })
      });
      if (res.ok) { alert("Sikeres megosztás!"); setShareEmail(''); }
    } catch (err) { alert("Hiba"); }
  };

  const handleUserChange = (newId: string) => {
    setViewingUserId(newId);
    fetchRecords(user.token, newId);
  };

  const handleSave = async () => {
    if (!value || !date || !user) return alert("Mezők!");
    try {
      await fetch(`${BACKEND_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ type, value: parseFloat(value), date })
      });
      setValue('');
      fetchRecords(user.token);
    } catch (err) { alert("Hiba"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Biztosan törlöd?") || !user) return;
    try {
      await fetch(`${BACKEND_URL}/api/records/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      fetchRecords(user.token);
    } catch (err) { alert("Hiba"); }
  };

  const currentTypeRecords = records.filter((r: any) => r.Type === filter)
    .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());

  const dailyData = currentTypeRecords.map((r: any) => ({ label: r.FormattedDate.split(' ')[0], ertek: parseFloat(r.Value) }));

  const getMonthlyConsumption = () => {
    const monthlySum: { [key: string]: number } = {};
    if (filter === 'Üzemanyag') {
      currentTypeRecords.forEach((r: any) => {
        const monthKey = r.FormattedDate.substring(0, 7);
        monthlySum[monthKey] = (monthlySum[monthKey] || 0) + parseFloat(r.Value);
      });
    } else {
      for (let i = 1; i < currentTypeRecords.length; i++) {
        const currentVal = parseFloat(currentTypeRecords[i].Value);
        const prevVal = parseFloat(currentTypeRecords[i - 1].Value);
        if (currentVal >= prevVal) {
          const monthKey = currentTypeRecords[i].FormattedDate.substring(0, 7);
          monthlySum[monthKey] = (monthlySum[monthKey] || 0) + (currentVal - prevVal);
        }
      }
    }
    return Object.keys(monthlySum).sort().map(m => ({ label: m, ertek: Math.round(monthlySum[m] * 100) / 100 }));
  };

  const getAnnualConsumption = () => {
    const annualSum: { [key: string]: number } = {};
    if (filter === 'Üzemanyag') {
      currentTypeRecords.forEach((r: any) => {
        const yearKey = r.FormattedDate.substring(0, 4);
        annualSum[yearKey] = (annualSum[yearKey] || 0) + parseFloat(r.Value);
      });
    } else {
      for (let i = 1; i < currentTypeRecords.length; i++) {
        const currentVal = parseFloat(currentTypeRecords[i].Value);
        const prevVal = parseFloat(currentTypeRecords[i - 1].Value);
        if (currentVal >= prevVal) {
          const yearKey = currentTypeRecords[i].FormattedDate.substring(0, 4);
          annualSum[yearKey] = (annualSum[yearKey] || 0) + (currentVal - prevVal);
        }
      }
    }
    return Object.keys(annualSum).sort().map(y => ({ label: y, ertek: Math.round(annualSum[y] * 100) / 100 }));
  };

  const chartData = viewMode === 'daily' ? dailyData : viewMode === 'monthly' ? getMonthlyConsumption() : getAnnualConsumption();
  const getUnit = (t: string) => t === 'Áram' ? 'kWh' : t === 'Üzemanyag' ? 'Ft' : 'm³';
  const getIcon = (t: string) => t === 'Áram' ? '⚡' : t === 'Víz' ? '💧' : t === 'Gáz' ? '🔥' : '⛽';
  const getColor = (t: string) => t === 'Áram' ? '#fbbf24' : t === 'Víz' ? '#38bdf8' : t === 'Gáz' ? '#f87171' : '#a855f7';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo">Rezsiapp</h1>
          {user && (
            <div className="user-info">
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={handleLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {!user ? (
          <section className="card login-card">
            <h2>Üdvözöljük a Rezsiappban!</h2>
            <p className="login-desc">
              Az alkalmazás használatához biztonságos Google-bejelentkezés szükséges. 
              Adataidat védett módon, a saját fiókodhoz kötve tároljuk.
            </p>
            <div className="google-btn-container">
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => alert('Hiba')} />
            </div>
          </section>
        ) : (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <div className="view-selector">
                  <select value={viewingUserId || ''} onChange={(e) => handleUserChange(e.target.value)}>
                    <option value={user.sub}>Saját adataim</option>
                    {sharedWithMe.map((s: any) => (
                      <option key={s.owner_id} value={s.owner_id}>🏠 {s.owner_email}</option>
                    ))}
                  </select>
                </div>
                {viewingUserId === user.sub && (
                  <div className="share-input-group">
                    <input type="email" placeholder="Megosztás..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                    <button className="btn-share" onClick={handleShare}>+</button>
                  </div>
                )}
              </section>
            </div>

            {viewingUserId === user.sub && (
              <section className="card main-card">
                <div className="input-row">
                  <div className="input-field">
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="Áram">⚡ Áram</option>
                      <option value="Víz">💧 Víz</option>
                      <option value="Gáz">🔥 Gáz</option>
                      <option value="Üzemanyag">⛽ Üzemanyag</option>
                    </select>
                  </div>
                  <div className="input-field"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="input-field"><input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" /></div>
                </div>
                <button className="btn-primary" onClick={handleSave}>Mentés</button>
              </section>
            )}

            <div className="controls-bar">
              <div className="filter-buttons">
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={filter === f ? {backgroundColor: getColor(f), borderColor: getColor(f)} : {}}>
                      {getIcon(f)} {f}
                  </button>
                ))}
              </div>
              <div className="view-toggle">
                <button className={viewMode === 'daily' ? 'active' : ''} onClick={() => setViewMode('daily')}>Napi</button>
                <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi</button>
                <button className={viewMode === 'annual' ? 'active' : ''} onClick={() => setViewMode('annual')}>Éves</button>
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  {viewMode === 'daily' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Line type="monotone" dataKey="ertek" stroke={getColor(filter)} strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} itemStyle={{color: '#f8fafc'}} formatter={(v: any) => [`${v.toLocaleString()} ${getUnit(filter)}`, 'Összesen']} />
                      <Bar dataKey="ertek" radius={[4, 4, 0, 0]}>
                        {chartData.map((e, i) => <Cell key={i} fill={getColor(filter)} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            {/* ADATOK SZEKCIÓ CÍMMEL ÉS GÖRGETÉSSEL */}
            <section className="list-section">
              <h3 className="section-title">Rögzített adatok</h3>
              <div className="list-container">
                <div className="records-grid">
                  {currentTypeRecords.slice().reverse().map((rec: any) => (
                    <div key={rec.Id} className={`record-item ${rec.Type}`}>
                      <div className="record-info">
                        <span>{getIcon(rec.Type)} {rec.Type} - {rec.FormattedDate}</span>
                      </div>
                      <div className="record-value-container">
                        <span className="record-value">{parseFloat(rec.Value).toLocaleString()} {getUnit(rec.Type)}</span>
                        {viewingUserId === user.sub && (
                          <button className="btn-delete" onClick={() => handleDelete(rec.Id)}>❌</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
