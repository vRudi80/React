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

  // Adatok lekérése (Saját vagy kiválasztott useré)
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

  // Megosztások lekérése
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}` 
        },
        body: JSON.stringify({ sharedWithEmail: shareEmail })
      });
      if (res.ok) {
        alert("Sikeres megosztás!");
        setShareEmail('');
      }
    } catch (err) { alert("Hiba a megosztáskor"); }
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

  // --- Adatfeldolgozás ---
  const currentTypeRecords = records.filter((r: any) => r.Type === filter)
    .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());

  const dailyData = currentTypeRecords.map((r: any) => ({ label: r.FormattedDate.split(' ')[0], ertek: parseFloat(r.Value) }));

  const getMonthlyConsumption = () => {
    if (filter === 'Üzemanyag') {
      const monthlySum: { [key: string]: number } = {};
      currentTypeRecords.forEach((r: any) => {
        const monthKey = r.FormattedDate.substring(0, 7);
        monthlySum[monthKey] = (monthlySum[monthKey] || 0) + parseFloat(r.Value);
      });
      return Object.keys(monthlySum).sort().map(month => ({ honap: month, fogyasztas: monthlySum[month] }));
    } else {
      const monthlyFirsts: { [key: string]: number } = {};
      const monthlyLasts: { [key: string]: number } = {};
      currentTypeRecords.forEach((r: any) => {
        const monthKey = r.FormattedDate.substring(0, 7);
        const val = parseFloat(r.Value);
        if (monthlyFirsts[monthKey] === undefined) monthlyFirsts[monthKey] = val;
        monthlyLasts[monthKey] = val;
      });
      const months = Object.keys(monthlyFirsts).sort();
      return months.map((month, i) => {
        const nextMonth = months[i + 1];
        let consumption = 0;
        if (nextMonth) {
          const diff = monthlyFirsts[nextMonth] - monthlyFirsts[month];
          consumption = diff >= 0 ? diff : (monthlyLasts[month] - monthlyFirsts[month]);
        } else {
          consumption = monthlyLasts[month] - monthlyFirsts[month];
        }
        return { honap: month, fogyasztas: Math.round(consumption * 100) / 100 };
      });
    }
  };

  const monthlyData = getMonthlyConsumption();
  const getUnit = (t: string) => t === 'Áram' ? 'kWh' : t === 'Üzemanyag' ? 'Ft' : 'm³';
  const getIcon = (t: string) => t === 'Áram' ? '⚡' : t === 'Víz' ? '💧' : t === 'Gáz' ? '🔥' : '⛽';
  const getColor = (t: string) => t === 'Áram' ? '#fbbf24' : t === 'Víz' ? '#38bdf8' : t === 'Gáz' ? '#f87171' : '#a855f7';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header>
          <h1>Rezsi & Tankolás</h1>
          {user && (
            <div className="user-profile">
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={handleLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {!user ? (
          <section className="card login-card">
            <h2>Bejelentkezés</h2>
            <div className="google-btn-container">
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => alert('Hiba')} />
            </div>
          </section>
        ) : (
          <>
            {/* MEGOSZTÁS SZEKCIÓ */}
            <section className="card share-card">
              <div className="view-selector">
                <label>Kinek az adatait látod?</label>
                <select value={viewingUserId || ''} onChange={(e) => handleUserChange(e.target.value)}>
                  <option value={user.sub}>Saját adataim</option>
                  {sharedWithMe.map((s: any) => (
                    <option key={s.owner_id} value={s.owner_id}>🏠 {s.owner_email}</option>
                  ))}
                </select>
              </div>
              <div className="share-input-group">
                <input 
                  type="email" 
                  placeholder="Email a megosztáshoz..." 
                  value={shareEmail} 
                  onChange={(e) => setShareEmail(e.target.value)} 
                />
                <button className="btn-share" onClick={handleShare}>Megosztás</button>
              </div>
            </section>

            {/* ADATBEVITEL (Csak ha a sajátunkat nézzük) */}
            {viewingUserId === user.sub && (
              <section className="card main-card">
                <h2>Új mérés</h2>
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
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  {viewMode === 'daily' ? (
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Line type="monotone" dataKey="ertek" stroke={getColor(filter)} strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                  ) : (
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="honap" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} itemStyle={{color: '#fff'}} />
                      <Bar dataKey="fogyasztas" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((e, i) => <Cell key={i} fill={getColor(filter)} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            <section className="list-section">
              <div className="records-grid">
                {currentTypeRecords.slice().reverse().map((rec: any) => (
                  <div key={rec.Id} className={`record-item ${rec.Type}`}>
                    <div className="record-info">
                      <span>{getIcon(rec.Type)} {rec.Type} - {rec.FormattedDate}</span>
                    </div>
                    <div className="record-value-container">
                      <span className="record-value">{parseFloat(rec.Value).toLocaleString()} {getUnit(rec.Type)}</span>
                      {viewingUserId === user.sub && (
                        <button className="btn-delete" onClick={() => alert("Törlés funkció...")}>❌</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
