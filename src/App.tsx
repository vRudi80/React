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
  const [records, setRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  
  const [recordMode, setRecordMode] = useState<'meter' | 'invoice'>('meter');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [meterDate, setMeterDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  const [showAssetManager, setShowAssetManager] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [newAsset, setNewAsset] = useState({ category: 'property', friendlyName: '', city: '', street: '', houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' });

  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('usage'); 

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    setInvoices([]);
    setAssets([]);
    localStorage.removeItem('userToken');
  };

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/shares/me`, { headers })
      ]);

      if (recRes.status === 401 || invRes.status === 401 || assetRes.status === 401) return forceLogout();

      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      const shrData = await shareRes.json();

      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
      setSharedWithMe(Array.isArray(shrData) ? shrData : []);
    } catch (err) { console.error("Fetch error"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        if (decoded.exp * 1000 < Date.now()) forceLogout();
        else {
          setUser({ ...decoded, token: savedToken });
          setViewingUserId(decoded.sub);
          fetchAll(savedToken, decoded.sub);
        }
      } catch (e) { forceLogout(); }
    }
  }, []);

  const getAllowedTypes = (assetId: string) => {
    if (assetId === 'all') return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'];
    const asset = assets.find((a: any) => a.Id == assetId);
    if (!asset) return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'];
    return asset.Category === 'property' ? ['Áram', 'Víz', 'Gáz', 'Internet', 'Szemétszállítás'] : ['Üzemanyag'];
  };

  useEffect(() => {
    const allowed = getAllowedTypes(selectedAssetId);
    if (allowed.length > 0 && !allowed.includes(filter) && filter !== 'Összes') {
      setFilter(allowed[0]);
    }
  }, [selectedAssetId]);

  const handleLoginSuccess = async (res: any) => {
    const token = res.credential;
    const decoded: any = jwtDecode(token);
    setUser({ ...decoded, token });
    setViewingUserId(decoded.sub);
    localStorage.setItem('userToken', token);
    await fetch(`${BACKEND_URL}/api/login-sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    fetchAll(token, decoded.sub);
  };

  const handleAssetSave = async () => {
    if (!newAsset.friendlyName) return alert("Adj nevet!");
    const res = await fetch(`${BACKEND_URL}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    if (res.ok) { setShowAssetManager(false); fetchAll(user.token); }
  };

  const handleSave = async () => {
    if (!value || !targetAssetId) return alert("Válassz eszközt!");
    const isInv = recordMode === 'invoice' || ['Üzemanyag', 'Internet', 'Szemétszállítás'].includes(type);
    const body = { type, value: parseFloat(value), amount: parseFloat(value), date: isInv ? invoiceDate : meterDate, assetId: targetAssetId };
    const res = await fetch(`${BACKEND_URL}${isInv ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token); }
  };

  const handleDelete = async (id: number, listType: 'meter' | 'invoice') => {
    if (!window.confirm("Törlöd?")) return;
    const endpoint = listType === 'meter' ? `/api/records/${id}` : `/api/invoices/${id}`;
    await fetch(`${BACKEND_URL}${endpoint}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } });
    fetchAll(user.token);
  };

  const handleShare = async () => {
    if (!shareEmail || !user) return;
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ sharedWithEmail: shareEmail.toLowerCase() })
    });
    if (res.ok) { alert("Sikeres megosztás!"); setShareEmail(''); }
  };

  const getChartData = () => {
    const keyLen = viewMode === 'monthly' ? 7 : 4;
    const dataMap: { [key: string]: { usage: number, cost: number } } = {};
    const fRecords = records.filter((r: any) => selectedAssetId === 'all' || r.AssetId == selectedAssetId);
    const fInvoices = invoices.filter((i: any) => selectedAssetId === 'all' || i.AssetId == selectedAssetId);

    if (displayMode === 'usage') {
      const filtered = fRecords.filter((r: any) => r.Type === filter).sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
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
      fInvoices.filter((inv: any) => filter === 'Összes' ? true : inv.Type === filter).forEach((inv: any) => {
        const d = String(inv.Month || "");
        const key = d.substring(0, keyLen);
        if (key) {
          if (!dataMap[key]) dataMap[key] = { usage: 0, cost: 0 };
          dataMap[key].cost += parseFloat(inv.Amount || 0);
        }
      });
    }
    return Object.keys(dataMap).sort().map(key => ({ label: key, ertek: displayMode === 'usage' ? Math.round(dataMap[key].usage * 100) / 100 : dataMap[key].cost }));
  };

  const chartData = getChartData();
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

  const fRec = records.filter((r: any) => selectedAssetId === 'all' || r.AssetId == selectedAssetId);
  const fInv = invoices.filter((i: any) => selectedAssetId === 'all' || i.AssetId == selectedAssetId);
  const combinedList = [
    ...(filter === 'Összes' ? [] : fRec.filter((r: any) => r.Type === filter).map((r: any) => ({ ...r, lType: 'meter', d: r.FormattedDate }))),
    ...fInv.filter((i: any) => filter === 'Összes' ? true : i.Type === filter).map((i: any) => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
  ].sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());

  const currentAsset = assets.find(a => a.Id == selectedAssetId);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo">Rezsiapp 2.0</h1>
          {user && (
            <div className="user-info">
              <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠 Eszközök</button>
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={forceLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {showAssetManager && user && (
          <section className="card asset-manager-card">
            <h3>Eszköz hozzáadása</h3>
            <div className="asset-form">
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                <option value="property">🏠 Ingatlan</option>
                <option value="car">🚗 Jármű</option>
              </select>
              <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
              {newAsset.category === 'property' ? (
                <input placeholder="m²" type="number" value={newAsset.area} onChange={(e) => setNewAsset({...newAsset, area: e.target.value})} />
              ) : (
                <input placeholder="Rendszám" value={newAsset.plateNumber} onChange={(e) => setNewAsset({...newAsset, plateNumber: e.target.value})} />
              )}
              <button className="btn-primary" onClick={handleAssetSave}>Mentés</button>
            </div>
            <div className="asset-list">
              {assets.map((a: any) => (
                <div key={a.Id} className="asset-item">
                  <span>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</span>
                  <button onClick={async () => { if(window.confirm("Törlöd?")) { await fetch(`${BACKEND_URL}/api/assets/${a.Id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }); fetchAll(user.token); } }}>❌</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!user ? (
          <section className="card login-card">
            <h2>Bejelentkezés</h2>
            <GoogleLogin onSuccess={handleLoginSuccess} />
          </section>
        ) : (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                {viewingUserId === user.sub && (
                  <div className="share-input-group">
                    <input type="email" placeholder="Megosztás..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                    <button className="btn-share" onClick={handleShare}>+</button>
                  </div>
                )}
              </section>
            </div>

            <section className="card record-card">
              <div className="record-type-toggle">
                <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')}>📟 Óra</button>
                <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
              </div>
              <div className="input-row">
                <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}>
                  <option value="">Eszköz...</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.FriendlyName}</option>))}
                </select>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {getAllowedTypes(targetAssetId).map(t => <option key={t} value={t}>{getIcon(t)} {t}</option>)}
                </select>
                <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték" />
              </div>
              <button className="btn-primary" onClick={handleSave}>Mentés</button>
            </section>

            <div className="controls-bar">
              <div className="filter-buttons">
                {getAllowedTypes(selectedAssetId).map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => { setFilter(f); if(['Üzemanyag', 'Internet', 'Szemétszállítás'].includes(f)) setDisplayMode('cost'); }} style={filter === f ? {backgroundColor: getColor(f), borderColor: getColor(f)} : {}}>
                    {getIcon(f)} {f}
                  </button>
                ))}
                {displayMode === 'cost' && (!currentAsset || currentAsset.Category !== 'car') && (
                  <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>{getIcon('Összes')} Összes</button>
                )}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={['Üzemanyag', 'Internet', 'Szemétszállítás', 'Összes'].includes(filter)} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
                <button className={displayMode === 'cost' ? 'active' : ''} onClick={() => setDisplayMode('cost')}>Költség</button>
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                    <YAxis fontSize={10} stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#f8fafc'}} formatter={(v:any) => [v?.toLocaleString() || 0, 'Érték']} />
                    <Bar dataKey="ertek" radius={[4, 4, 0, 0]}>{chartData.map((e, i) => <Cell key={i} fill={getColor()} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="list-section">
              <div className="list-container">
                {combinedList.map((item: any, idx) => {
                  const asset = assets.find((a: any) => a.Id == item.AssetId);
                  return (
                    <div key={idx} className={`record-item ${item.Type}`}>
                      <div className="record-info">
                        <div className="record-main-line">
                          <span>{item.lType === 'meter' ? '📟' : '💰'} {item.d ? String(item.d).substring(0, 10) : ''} ({item.Type})</span>
                        </div>
                        <div className="asset-tag">
                          {asset ? (
                            <>
                              {asset.Category === 'car' ? '🚗' : '🏠'} {asset.FriendlyName}
                              {asset.Category === 'car' && asset.PlateNumber ? ` • ${asset.PlateNumber}` : ''}
                            </>
                          ) : <span className="no-asset">Nincs eszköz</span>}
                        </div>
                      </div>
                      <div className="record-value-container">
                        <span className="record-value">{(parseFloat(item.Value) || 0).toLocaleString()} {item.lType === 'meter' ? (item.Type === 'Áram' ? 'kWh' : 'm³') : 'Ft'}</span>
                        <button className="btn-delete" onClick={() => handleDelete(item.Id || item.id, item.lType)}>❌</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
