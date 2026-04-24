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
  const [invoices, setInvoices] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  
  const [recordMode, setRecordMode] = useState<'meter' | 'invoice'>('meter');
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().substring(0, 7));

  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('usage'); 
  const [shareEmail, setShareEmail] = useState('');

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/shares/me`, { headers })
      ]);
      const recData = recRes.ok ? await recRes.json() : [];
      const invData = invRes.ok ? await invRes.json() : [];
      const shrData = shareRes.ok ? await shareRes.json() : [];
      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setSharedWithMe(Array.isArray(shrData) ? shrData : []);
    } catch (err) { console.error("Hiba az adatok frissítésekor"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        setUser({ ...decoded, token: savedToken });
        setViewingUserId(decoded.sub);
        fetchAll(savedToken, decoded.sub);
      } catch (e) { localStorage.removeItem('userToken'); }
    }
  }, []);

  const handleLoginSuccess = (credentialResponse: any) => {
    const token = credentialResponse.credential;
    const decoded: any = jwtDecode(token);
    setUser({ ...decoded, token: token });
    setViewingUserId(decoded.sub);
    localStorage.setItem('userToken', token);
    fetchAll(token, decoded.sub);
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    setInvoices([]);
    localStorage.removeItem('userToken');
  };

  const handleSave = async () => {
    if (!user || !value) return alert("Adj meg egy értéket!");
    try {
      const isInv = recordMode === 'invoice' || ['Üzemanyag', 'Internet', 'Szemétszállítás'].includes(type);
      const body = isInv 
        ? { type, amount: parseFloat(value), month: invoiceMonth }
        : { type, value: parseFloat(value), date };
      const res = await fetch(`${BACKEND_URL}${isInv ? '/api/invoices' : '/api/records'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) { setValue(''); fetchAll(user.token); }
    } catch (err) { alert("Hiba a mentéskor"); }
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
      else { alert("Hiba a megosztáskor!"); }
    } catch (err) { alert("Szerver hiba"); }
  };

  const handleDelete = async (id: number, listType: 'meter' | 'invoice') => {
    if (!window.confirm("Biztosan törlöd ezt a tételt?") || !user) return;
    const endpoint = listType === 'meter' ? `/api/records/${id}` : `/api/invoices/${id}`;
    const res = await fetch(`${BACKEND_URL}${endpoint}`, { 
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } 
    });
    if (res.ok) { fetchAll(user.token); }
  };

  const handleUserChange = (newId: string) => {
    setViewingUserId(newId);
    fetchAll(user.token, newId);
  };

  const getChartData = () => {
    if (displayMode === 'cost' && viewMode === 'daily') return [];
    const keyLen = viewMode === 'monthly' ? 7 : 4;
    const dataMap: { [key: string]: { usage: number, cost: number } } = {};
    if (displayMode === 'usage') {
      const filtered = records.filter((r: any) => r.Type === filter)
        .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
      if (viewMode === 'daily') return filtered.map((r: any) => ({ label: r.FormattedDate.split(' ')[0], ertek: parseFloat(r.Value) }));
      for (let i = 1; i < filtered.length; i++) {
        const curV = parseFloat(filtered[i].Value);
        const preV = parseFloat(filtered[i-1].Value);
        if (curV >= preV) {
          const key = filtered[i].FormattedDate.substring(0, keyLen);
          if (!dataMap[key]) dataMap[key] = { usage: 0, cost: 0 };
          dataMap[key].usage += (curV - preV);
        }
      }
    } else {
      invoices.filter((inv: any) => filter === 'Összes' ? true : inv.Type === filter).forEach((inv: any) => {
        const key = inv.Month.substring(0, keyLen);
        if (!dataMap[key]) dataMap[key] = { usage: 0, cost: 0 };
        dataMap[key].cost += parseFloat(inv.Amount);
      });
    }
    return Object.keys(dataMap).sort().map(key => ({
      label: key, ertek: displayMode === 'usage' ? Math.round(dataMap[key].usage * 100) / 100 : dataMap[key].cost
    }));
  };

  const finalData = getChartData();
  const getUnit = () => displayMode === 'cost' ? 'Ft' : (filter === 'Áram' ? 'kWh' : 'm³');
  const getIcon = (t: string) => {
    switch(t) {
      case 'Áram': return '⚡'; case 'Víz': return '💧'; case 'Gáz': return '🔥';
      case 'Üzemanyag': return '⛽'; case 'Internet': return '🌐'; 
      case 'Szemétszállítás': return '🗑️'; case 'Összes': return '📊';
      default: return '📄';
    }
  };
  const getColor = (t: string = filter) => {
    if (displayMode === 'cost' && t !== 'Összes') return '#10b981';
    if (t === 'Összes') return '#6366f1';
    switch(t) {
      case 'Áram': return '#fbbf24'; case 'Víz': return '#38bdf8'; case 'Gáz': return '#f87171';
      case 'Üzemanyag': return '#a855f7'; case 'Internet': return '#ec4899';
      case 'Szemétszállítás': return '#94a3b8'; default: return '#3b82f6';
    }
  };

  const isInvoiceOnly = (t: string) => ['Üzemanyag', 'Internet', 'Szemétszállítás'].includes(t);
  const combinedList = [
    ...(filter === 'Összes' ? [] : records.filter((r: any) => r.Type === filter).map((r: any) => ({ ...r, lType: 'meter' }))),
    ...invoices.filter((i: any) => filter === 'Összes' ? true : i.Type === filter).map((i: any) => ({ ...i, lType: 'invoice', Value: i.Amount, FormattedDate: i.Month }))
  ].sort((a, b) => new Date(b.FormattedDate).getTime() - new Date(a.FormattedDate).getTime());

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
                    <option value={user.sub}>🏠 Saját adataim</option>
                    {sharedWithMe.map((s: any) => (<option key={s.owner_id} value={s.owner_id}>🤝 {s.owner_email}</option>))}
                  </select>
                </div>
                {viewingUserId === user.sub && (
                  <div className="share-input-group">
                    <input type="email" placeholder="Email a megosztáshoz..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                    <button className="btn-share" onClick={handleShare}>+</button>
                  </div>
                )}
              </section>
            </div>

            {viewingUserId === user.sub && (
              <section className="card record-card">
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => { setRecordMode('meter'); if(isInvoiceOnly(type)) setType('Áram'); }}>📟 Mérőóra</button>
                  <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
                </div>
                <div className="input-row">
                  <select value={type} onChange={(e) => { setType(e.target.value); if(isInvoiceOnly(e.target.value)) setRecordMode('invoice'); }}>
                    <option value="Áram">⚡ Áram</option><option value="Víz">💧 Víz</option><option value="Gáz">🔥 Gáz</option>
                    {recordMode === 'invoice' && (<><option value="Üzemanyag">⛽ Üzemanyag</option><option value="Internet">🌐 Internet</option><option value="Szemétszállítás">🗑️ Szemét</option></>)}
                  </select>
                  {recordMode === 'meter' ? (<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />) : (<input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} />)}
                  <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Összeg" />
                </div>
                <button className="btn-primary" onClick={handleSave}>Mentés</button>
              </section>
            )}

            <div className="controls-bar">
              <div className="filter-buttons">
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => { setFilter(f); if(isInvoiceOnly(f)) setDisplayMode('cost'); }} style={filter === f ? {backgroundColor: getColor(f), borderColor: getColor(f)} : {}}>
                    {getIcon(f)} {f}
                  </button>
                ))}
                {displayMode === 'cost' && (<button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>{getIcon('Összes')} Összes</button>)}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={isInvoiceOnly(filter) || filter === 'Összes'} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
                <button className={displayMode === 'cost' ? 'active' : ''} onClick={() => setDisplayMode('cost')}>Költség (Ft)</button>
              </div>
              <div className="view-toggle">
                <button disabled={displayMode === 'cost'} className={viewMode === 'daily' ? 'active' : ''} onClick={() => setViewMode('daily')}>Napi</button>
                <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi</button>
                <button className={viewMode === 'annual' ? 'active' : ''} onClick={() => setViewMode('annual')}>Éves</button>
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300 }}>
                {displayMode === 'cost' && viewMode === 'daily' ? (
                  <div className="no-data-msg">Válassz Havi vagy Éves nézetet a költségekhez!</div>
                ) : (
                  <ResponsiveContainer>
                    {viewMode === 'daily' ? (
                      <LineChart data={finalData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                        <YAxis fontSize={10} stroke="#94a3b8" />
                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} labelStyle={{color: '#94a3b8', fontWeight: 'bold'}} />
                        <Line type="monotone" dataKey="ertek" stroke={getColor()} strokeWidth={3} dot={{fill: getColor()}} />
                      </LineChart>
                    ) : (
                      <BarChart data={finalData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                        <YAxis fontSize={10} stroke="#94a3b8" />
                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} labelStyle={{color: '#94a3b8', fontWeight: 'bold'}} itemStyle={{color: '#f8fafc'}} formatter={(v:any) => [`${v.toLocaleString()} ${getUnit()}`, displayMode==='usage'?'Fogyasztás':'Összeg']} />
                        <Bar dataKey="ertek" radius={[4, 4, 0, 0]}>{finalData.map((e, i) => <Cell key={i} fill={getColor()} />)}</Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="list-section">
              <h3 className="section-title">Adatok: {filter}</h3>
              <div className="list-container">
                {combinedList.length === 0 ? <p className="no-data-msg">Nincs rögzített adat.</p> : combinedList.map((item: any, idx) => (
                  <div key={idx} className={`record-item ${item.Type} ${item.lType}`}>
                    <div className="record-info">
                      <span>{item.lType === 'meter' ? '📟 Állás' : '💰 Számla'} - {item.FormattedDate} ({item.Type})</span>
                    </div>
                    <div className="record-value-container">
                      <span className="record-value">{parseFloat(item.Value).toLocaleString()} {item.lType === 'meter' ? (item.Type === 'Áram' ? 'kWh' : 'm³') : 'Ft'}</span>
                      {viewingUserId === user.sub && (
                        <button className="btn-delete" onClick={() => handleDelete(item.Id || item.id, item.lType)}>❌</button>
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
