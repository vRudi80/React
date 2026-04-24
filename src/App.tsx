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

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/shares/me`, { headers })
      ]);
      if (recRes.ok) setRecords(await recRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (shareRes.ok) setSharedWithMe(await shareRes.json());
    } catch (err) { console.error("Hiba az adatok lekérésekor"); }
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
      const isInvoice = recordMode === 'invoice' || type === 'Üzemanyag';
      if (isInvoice) {
        await fetch(`${BACKEND_URL}/api/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
          body: JSON.stringify({ type, amount: parseFloat(value), month: invoiceMonth })
        });
      } else {
        await fetch(`${BACKEND_URL}/api/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
          body: JSON.stringify({ type, value: parseFloat(value), date })
        });
      }
      setValue('');
      fetchAll(user.token);
    } catch (err) { alert("Szerver hiba mentéskor"); }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm("Törlöd ezt a mérőóra állást?") || !user) return;
    await fetch(`${BACKEND_URL}/api/records/${id}`, { 
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } 
    });
    fetchAll(user.token);
  };

  const handleUserChange = (newId: string) => {
    setViewingUserId(newId);
    fetchAll(user.token, newId);
  };

  // --- GRAFIKON ADATOK GENERÁLÁSA ---
  const getChartData = () => {
    if (displayMode === 'cost' && viewMode === 'daily') return [];

    if (viewMode === 'daily' && displayMode === 'usage') {
      const filtered = records.filter((r: any) => r.Type === filter)
        .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
      return filtered.map((r: any) => ({ label: r.FormattedDate.split(' ')[0], ertek: parseFloat(r.Value) }));
    }

    const dataMap: { [key: string]: { usage: number, cost: number } } = {};
    const keyLen = viewMode === 'monthly' ? 7 : 4;

    if (displayMode === 'usage') {
      const filtered = records.filter((r: any) => r.Type === filter)
        .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
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
      label: key,
      ertek: displayMode === 'usage' ? Math.round(dataMap[key].usage * 100) / 100 : dataMap[key].cost
    }));
  };

  const finalData = getChartData();
  const getUnit = () => displayMode === 'cost' ? 'Ft' : (filter === 'Áram' ? 'kWh' : 'm³');
  const getIcon = (t: string) => t === 'Áram' ? '⚡' : t === 'Víz' ? '💧' : t === 'Gáz' ? '🔥' : t === 'Üzemanyag' ? '⛽' : '📊';
  const getColor = () => {
    if (displayMode === 'cost') return filter === 'Összes' ? '#6366f1' : '#10b981';
    if (filter === 'Áram') return '#fbbf24';
    if (filter === 'Víz') return '#38bdf8';
    if (filter === 'Gáz') return '#f87171';
    return '#a855f7';
  };

  // LISTA KOMBINÁLÁSA (Mérőóra + Számlák)
  const combinedList = [
    ...records.filter((r: any) => r.Type === filter).map((r: any) => ({ ...r, listType: 'meter', sortDate: r.FormattedDate })),
    ...invoices.filter((i: any) => i.Type === filter).map((i: any) => ({ ...i, listType: 'invoice', sortDate: i.Month, Value: i.Amount, FormattedDate: i.Month }))
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

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
            <h2>Üdvözöljük!</h2>
            <p className="login-desc">Jelentkezzen be az adatai kezeléséhez.</p>
            <div className="google-btn-container"><GoogleLogin onSuccess={handleLoginSuccess} /></div>
          </section>
        ) : (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <select value={viewingUserId || ''} onChange={(e) => handleUserChange(e.target.value)}>
                  <option value={user.sub}>Saját adataim</option>
                  {sharedWithMe.map((s: any) => (
                    <option key={s.owner_id} value={s.owner_id}>🏠 {s.owner_email}</option>
                  ))}
                </select>
              </section>
            </div>

            {viewingUserId === user.sub && (
              <section className="card record-card">
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' && type !== 'Üzemanyag' ? 'active' : ''} 
                          disabled={type === 'Üzemanyag'}
                          onClick={() => setRecordMode('meter')}>Mérőóra</button>
                  <button className={recordMode === 'invoice' || type === 'Üzemanyag' ? 'active' : ''} 
                          onClick={() => setRecordMode('invoice')}>Számla</button>
                </div>
                <div className="input-row">
                  <select value={type} onChange={(e) => { setType(e.target.value); if(e.target.value==='Üzemanyag') setRecordMode('invoice'); }}>
                    <option value="Áram">⚡ Áram</option>
                    <option value="Víz">💧 Víz</option>
                    <option value="Gáz">🔥 Gáz</option>
                    <option value="Üzemanyag">⛽ Üzemanyag</option>
                  </select>
                  {recordMode === 'meter' && type !== 'Üzemanyag' ? (
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  ) : (
                    <input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} />
                  )}
                  <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Összeg" />
                </div>
                <button className="btn-primary" onClick={handleSave}>Mentés</button>
              </section>
            )}

            <div className="controls-bar">
              <div className="filter-buttons">
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => { setFilter(f); if(f==='Üzemanyag') setDisplayMode('cost'); }} style={filter === f ? {backgroundColor: getColor(), borderColor: getColor()} : {}}>
                    {getIcon(f)} {f}
                  </button>
                ))}
                {displayMode === 'cost' && (
                  <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? '#6366f1' : ''}}>📊 Összes</button>
                )}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={filter === 'Üzemanyag' || filter === 'Összes'} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
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
                      <LineChart data={finalData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Line type="monotone" dataKey="ertek" stroke={getColor()} strokeWidth={3} dot={{fill: getColor()}} /></LineChart>
                    ) : (
                      <BarChart data={finalData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v:any) => [`${v.toLocaleString()} ${getUnit()}`, displayMode==='usage'?'Fogyasztás':'Összeg']} /><Bar dataKey="ertek" radius={[4, 4, 0, 0]}>{finalData.map((e, i) => <Cell key={i} fill={getColor()} />)}</Bar></BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="list-section">
              <h3 className="section-title">Rögzített adatok ({filter})</h3>
              <div className="list-container">
                {combinedList.map((item: any, idx) => (
                  <div key={idx} className={`record-item ${item.Type} ${item.listType}`}>
                    <div className="record-info">
                      <span>{item.listType === 'meter' ? '📟 Állás' : '💰 Számla'} - {item.FormattedDate}</span>
                    </div>
                    <div className="record-value-container">
                      <span className="record-value">{parseFloat(item.Value).toLocaleString()} {item.listType === 'meter' ? getUnit() : 'Ft'}</span>
                      {viewingUserId === user.sub && item.listType === 'meter' && <button className="btn-delete" onClick={() => handleDeleteRecord(item.Id)}>❌</button>}
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
