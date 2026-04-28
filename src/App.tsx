import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend 
} from 'recharts';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import './App.css';

const BACKEND_URL = "https://react-ideas-backend.onrender.com";
const GOOGLE_CLIENT_ID = "197361744572-ih728hq5jft3fqfd1esvktvrd8i97kcp.apps.googleusercontent.com";
const ASSET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [newAsset, setNewAsset] = useState({ 
    category: 'property', friendlyName: '', city: '', street: '', 
    houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' 
  });

  const [filter, setFilter] = useState('Összes');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('cost');

  // --- FUNKCIÓK ---

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]); setInvoices([]); setAssets([]);
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
      if (recRes.status === 401) return forceLogout();
      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      const shrData = await shareRes.json();
      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
      setSharedWithMe(Array.isArray(shrData) ? shrData : []);
    } catch (err) { console.error("Adatlekérési hiba"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        setUser({ ...decoded, token: savedToken });
        setViewingUserId(decoded.sub);
        fetchAll(savedToken, decoded.sub);
      } catch (e) { forceLogout(); }
    }
  }, []);

  const getAllowedTypes = (assetId: string) => {
    if (!assetId || assetId === 'all') return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'];
    const asset = assets.find((a: any) => String(a.Id) === String(assetId));
    return asset?.Category === 'property' ? ['Áram', 'Víz', 'Gáz', 'Internet', 'Szemétszállítás', 'Albérlet'] : ['Üzemanyag'];
  };

  // --- AUTOMATIKUS SZINKRON ---
  useEffect(() => {
    if (selectedAssetId !== 'all') {
      setTargetAssetId(selectedAssetId);
      const asset = assets.find(a => String(a.Id) === String(selectedAssetId));
      if (asset?.Category === 'car') { setFilter('Üzemanyag'); setDisplayMode('cost'); }
    } else { setFilter('Összes'); setDisplayMode('cost'); }
  }, [selectedAssetId, assets.length]);

  useEffect(() => {
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    const isInvoiceType = ['Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'].includes(type);
    if (asset?.Category === 'car' || isInvoiceType) setRecordMode('invoice');
    const allowed = getAllowedTypes(targetAssetId);
    if (!allowed.includes(type)) setType(allowed[0]);
  }, [targetAssetId, type, assets]);

  // --- GRAFIKON ADATOK ---
  const chartData = useMemo(() => {
    const keyLen = viewMode === 'monthly' ? 7 : 4;
    const dataMap: { [key: string]: any } = {};
    const fRec = records.filter((r: any) => selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId));
    const fInv = invoices.filter((i: any) => selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId));

    if (displayMode === 'usage') {
      const filtered = fRec.filter((r: any) => r.Type === filter).sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
      for (let i = 1; i < filtered.length; i++) {
        const diff = parseFloat(filtered[i].Value) - parseFloat(filtered[i-1].Value);
        if (diff >= 0) {
          const key = filtered[i].FormattedDate.substring(0, keyLen);
          const asset = assets.find(a => String(a.Id) === String(filtered[i].AssetId));
          const label = asset ? asset.FriendlyName : 'Saját';
          if (!dataMap[key]) dataMap[key] = { label: key };
          dataMap[key][label] = (dataMap[key][label] || 0) + diff;
        }
      }
    } else {
      fInv.filter((inv: any) => filter === 'Összes' ? true : inv.Type === filter).forEach((inv: any) => {
        const key = String(inv.Month || "").substring(0, keyLen);
        const asset = assets.find(a => String(a.Id) === String(inv.AssetId));
        const label = asset ? asset.FriendlyName : 'Saját';
        if (key && key.length >= 4) {
          if (!dataMap[key]) dataMap[key] = { label: key };
          dataMap[key][label] = (dataMap[key][label] || 0) + parseFloat(inv.Amount || 0);
        }
      });
    }
    return Object.values(dataMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [records, invoices, assets, filter, displayMode, viewMode, selectedAssetId]);

  // --- HANDLEREK ---

  const handleAssetSave = async () => {
    if (!newAsset.friendlyName) return alert("Adj nevet az eszköznek!");
    const method = editingAssetId ? 'PUT' : 'POST';
    const url = editingAssetId ? `${BACKEND_URL}/api/assets/${editingAssetId}` : `${BACKEND_URL}/api/assets`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    if (res.ok) { setEditingAssetId(null); setShowAssetManager(false); fetchAll(user.token); }
  };

  const handleSave = async () => {
    if (!value || !targetAssetId) return alert("Válassz eszközt!");
    const isInvoiceType = ['Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'].includes(type);
    const body = { type, value: parseFloat(value), amount: parseFloat(value), date: (recordMode === 'invoice' || isInvoiceType) ? invoiceDate : meterDate, assetId: parseInt(targetAssetId) };
    const res = await fetch(`${BACKEND_URL}${recordMode === 'invoice' || isInvoiceType ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token); alert("Mentve!"); }
  };

  const handleShare = async () => {
    if (!shareEmail) return alert("Adj meg egy email címet!");
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ sharedWithEmail: shareEmail.toLowerCase().trim() })
    });
    if (res.ok) { alert("Sikeres megosztás!"); setShareEmail(''); }
    else { const data = await res.json(); alert("Hiba: " + data.error); }
  };

  const getIcon = (t: string) => {
    switch(t) {
      case 'Áram': return '⚡'; case 'Víz': return '💧'; case 'Gáz': return '🔥';
      case 'Üzemanyag': return '⛽'; case 'Internet': return '🌐'; 
      case 'Szemétszállítás': return '🗑️'; case 'Albérlet': return '🏘️';
      case 'Összes': return '📊'; default: return '📄';
    }
  };

  const getColor = (t: string = filter) => {
    if (displayMode === 'cost' && t !== 'Összes') return '#10b981';
    if (t === 'Összes') return '#6366f1';
    switch(t) {
      case 'Áram': return '#fbbf24'; case 'Víz': return '#38bdf8'; case 'Gáz': return '#f87171';
      case 'Üzemanyag': return '#a855f7'; case 'Internet': return '#ec4899';
      case 'Szemétszállítás': return '#94a3b8'; case 'Albérlet': return '#f472b6';
      default: return '#3b82f6';
    }
  };

  const combinedList = [
    ...(filter === 'Összes' ? [] : records.filter(r => (selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId)) && r.Type === filter).map(r => ({ ...r, lType: 'meter', d: r.FormattedDate }))),
    ...invoices.filter(i => (selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId)) && (filter === 'Összes' ? true : i.Type === filter)).map(i => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
  ].sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());

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
            <h3>{editingAssetId ? "Módosítás" : "Új eszköz"}</h3>
            <div className="asset-form">
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                <option value="property">🏠 Ingatlan</option><option value="car">🚗 Jármű</option>
              </select>
              <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
              {newAsset.category === 'property' ? (
                <>
                  <input placeholder="Város" value={newAsset.city} onChange={(e) => setNewAsset({...newAsset, city: e.target.value})} />
                  <input placeholder="Utca, házszám" value={newAsset.street} onChange={(e) => setNewAsset({...newAsset, street: e.target.value})} />
                  <input placeholder="m²" type="number" value={newAsset.area} onChange={(e) => setNewAsset({...newAsset, area: e.target.value})} />
                </>
              ) : (
                <input placeholder="Rendszám" value={newAsset.plateNumber} onChange={(e) => setNewAsset({...newAsset, plateNumber: e.target.value})} />
              )}
              <div className="asset-form-buttons">
                 <button className="btn-primary" onClick={handleAssetSave}>Mentés</button>
                 {editingAssetId && <button className="btn-secondary" onClick={() => { setEditingAssetId(null); }}>Mégse</button>}
              </div>
            </div>
            <div className="asset-list">
              {assets.map((a: any) => (
                <div key={a.Id} className="asset-item">
                  <div className="asset-item-info"><span>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</span><small>{a.Category === 'car' ? a.PlateNumber : a.City}</small></div>
                  <button className="btn-edit-small" onClick={() => { setEditingAssetId(a.Id); setNewAsset({...a}); }}>✏️</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {user ? (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <div style={{marginBottom: '10px'}}>
                  <label style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Megtekintett fiók:</label>
                  <select value={viewingUserId || ''} onChange={(e) => { setViewingUserId(e.target.value); setSelectedAssetId('all'); fetchAll(user.token, e.target.value); }}>
                    <option value={user.sub}>Saját fiókom</option>
                    {sharedWithMe.map((s: any) => <option key={s.owner_id} value={s.owner_id}>👥 {s.owner_email}</option>)}
                  </select>
                </div>
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített nézet</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                {viewingUserId === user.sub && (
                  <div className="share-input-group">
                    <input type="email" placeholder="Megosztás (email)..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                    <button className="btn-share" onClick={handleShare}>+</button>
                  </div>
                )}
              </section>
            </div>

            <section className="card record-card">
              <div className="record-type-toggle">
                <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car' || ['Internet', 'Szemétszállítás', 'Albérlet'].includes(type)}>📟 Óraállás</button>
                <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
              </div>
              <div className="input-row">
                <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}><option value="">Eszköz...</option>{assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.FriendlyName}</option>))}</select>
                <select value={type} onChange={(e) => setType(e.target.value)}>{getAllowedTypes(targetAssetId).map(t => <option key={t} value={t}>{getIcon(t)} {t}</option>)}</select>
                <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Ft" />
              </div>
              <button className="btn-primary" onClick={handleSave}>Adat mentése</button>
            </section>

            <div className="controls-bar">
              <div className="filter-buttons">
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={filter === f ? {backgroundColor: getColor(f), borderColor: getColor(f)} : {}}>{getIcon(f)} {f}</button>
                ))}
                {displayMode === 'cost' && <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>{getIcon('Összes')} Összes</button>}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={['Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet', 'Összes'].includes(filter)} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
                <button className={displayMode === 'cost' ? 'active' : ''} onClick={() => setDisplayMode('cost')}>Költség</button>
              </div>
              <div className="view-toggle">
                <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi</button>
                <button className={viewMode === 'annual' ? 'active' : ''} onClick={() => setViewMode('annual')}>Éves</button>
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                      <YAxis fontSize={10} stroke="#94a3b8" />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Legend />
                      {(selectedAssetId === 'all' ? assets : assets.filter(a => String(a.Id) === String(selectedAssetId))).map((asset, idx) => (
                        <Bar key={asset.Id} dataKey={asset.FriendlyName} stackId="a" fill={selectedAssetId === 'all' ? ASSET_COLORS[idx % ASSET_COLORS.length] : getColor()} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="no-data-msg">Nincs adat</div>}
              </div>
            </section>

            <section className="list-section">
              <div className="list-container">
                {combinedList.map((item: any, idx) => {
                  const asset = assets.find(a => String(a.Id) === String(item.AssetId));
                  return (
                    <div key={idx} className={`record-item ${item.Type}`}>
                      <div className="record-info">
                        <div className="record-main-line"><span>{item.lType === 'meter' ? '📟' : '💰'} {String(item.d).substring(0, 10)} ({item.Type})</span></div>
                        <div className="asset-tag">{asset ? <>{asset.Category === 'car' ? '🚗' : '🏠'} {asset.FriendlyName}</> : 'Nincs eszköz'}</div>
                      </div>
                      <div className="record-value-container">
                        <span className="record-value">{(parseFloat(item.Value) || 0).toLocaleString()} {item.lType === 'meter' ? (item.Type === 'Áram' ? 'kWh' : 'm³') : 'Ft'}</span>
                        <button className="btn-delete" onClick={async () => { if(window.confirm("Törlöd?")) { await fetch(`${BACKEND_URL}/api/${item.lType === 'meter' ? 'records' : 'invoices'}/${item.Id || item.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }); fetchAll(user.token); } }}>❌</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="card login-card"><GoogleLogin onSuccess={(res) => { const token = res.credential!; const decoded: any = jwtDecode(token); setUser({...decoded, token}); localStorage.setItem('userToken', token); fetchAll(token, decoded.sub); }} /></section>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
