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

  const [filter, setFilter] = useState('Összes'); // Alapból az Összes-en induljon
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('cost'); // Alapból a Költség nézet

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    localStorage.removeItem('userToken');
  };

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${id}`, { headers })
      ]);
      if (recRes.status === 401) return forceLogout();
      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
    } catch (err) { console.error("Hiba az adatok letöltésekor"); }
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
    if (!assetId || assetId === 'all') return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'];
    const asset = assets.find((a: any) => String(a.Id) === String(assetId));
    if (!asset) return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'];
    return asset.Category === 'property' ? ['Áram', 'Víz', 'Gáz', 'Internet', 'Szemétszállítás'] : ['Üzemanyag'];
  };

  // --- AUTOMATIKUS SZŰRÉS VÁLTÁSKOR ---
  useEffect(() => {
    const allowed = getAllowedTypes(selectedAssetId);
    if (selectedAssetId !== 'all') {
      setTargetAssetId(selectedAssetId);
      const asset = assets.find(a => String(a.Id) === String(selectedAssetId));
      if (asset?.Category === 'car') {
        setFilter('Üzemanyag');
        setDisplayMode('cost');
      } else if (filter === 'Üzemanyag') {
        setFilter('Áram');
      }
    } else {
       // Ha összesített nézetbe váltunk, engedjük az "Összes" gombot
       setFilter('Összes');
       setDisplayMode('cost');
    }
  }, [selectedAssetId, assets.length]);

  useEffect(() => {
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    if (asset?.Category === 'car') setRecordMode('invoice');
    const allowed = getAllowedTypes(targetAssetId);
    if (!allowed.includes(type)) setType(allowed[0]);
  }, [targetAssetId, assets]);

  // --- GRAFIKON ADATOK GENERÁLÁSA ---
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
          const label = asset ? asset.FriendlyName : 'Egyéb';
          if (!dataMap[key]) dataMap[key] = { label: key };
          dataMap[key][label] = (dataMap[key][label] || 0) + diff;
        }
      }
    } else {
      fInv.filter((inv: any) => filter === 'Összes' ? true : inv.Type === filter).forEach((inv: any) => {
        const key = String(inv.Month || "").substring(0, keyLen);
        const asset = assets.find(a => String(a.Id) === String(inv.AssetId));
        const label = asset ? asset.FriendlyName : 'Egyéb';
        if (key && key.length >= 4) {
          if (!dataMap[key]) dataMap[key] = { label: key };
          dataMap[key][label] = (dataMap[key][label] || 0) + parseFloat(inv.Amount || 0);
        }
      });
    }
    return Object.values(dataMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [records, invoices, assets, filter, displayMode, viewMode, selectedAssetId]);

  const handleSave = async () => {
    if (!value || !targetAssetId) return alert("Válassz eszközt!");
    const isFuel = type === 'Üzemanyag';
    const body = { 
      type, value: parseFloat(value), amount: parseFloat(value), 
      date: (recordMode === 'invoice' || isFuel) ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };
    const res = await fetch(`${BACKEND_URL}${recordMode === 'invoice' || isFuel ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token); alert("Mentve!"); }
  };

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

  const fRecFinal = records.filter((r: any) => selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId));
  const fInvFinal = invoices.filter((i: any) => selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId));
  const combinedList = [
    ...(filter === 'Összes' ? [] : fRecFinal.filter((r: any) => r.Type === filter).map((r: any) => ({ ...r, lType: 'meter', d: r.FormattedDate }))),
    ...fInvFinal.filter((i: any) => filter === 'Összes' ? true : i.Type === filter).map((i: any) => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
  ].sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo">Rezsiapp 2.0</h1>
          {user && (
            <div className="user-info">
              <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠 Eszközök</button>
              <img src={user.picture} alt="Profil" onClick={forceLogout} title="Kijelentkezés" />
            </div>
          )}
        </header>

        {showAssetManager && user && (
          <section className="card asset-manager-card">
            <div className="asset-form">
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                <option value="property">🏠 Ingatlan</option><option value="car">🚗 Jármű</option>
              </select>
              <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
              <button className="btn-primary" onClick={handleAssetSave}>Mentés</button>
            </div>
            <div className="asset-list">
              {assets.map((a: any) => (
                <div key={a.Id} className="asset-item">
                  <span>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</span>
                  <button onClick={() => { setEditingAssetId(a.Id); setNewAsset({...a, category: a.Category, friendlyName: a.FriendlyName}); }}>✏️</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!user ? (
          <section className="card login-card"><GoogleLogin onSuccess={(res) => { const token = res.credential!; const decoded: any = jwtDecode(token); setUser({...decoded, token}); localStorage.setItem('userToken', token); fetchAll(token, decoded.sub); }} /></section>
        ) : (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített nézet</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                <div className="share-input-group">
                  <input type="email" placeholder="Email..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                  <button className="btn-share" onClick={() => {/* megosztás hívás */}}>+</button>
                </div>
              </section>
            </div>

            <section className="card record-card">
              <div className="record-type-toggle">
                <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car'}>📟 Óraállás</button>
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
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={filter === f ? {backgroundColor: getColor(f), borderColor: getColor(f)} : {}}>{getIcon(f)} {f}</button>
                ))}
                {displayMode === 'cost' && (
                   <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>{getIcon('Összes')} Összes</button>
                )}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={filter === 'Üzemanyag' || filter === 'Összes' || filter === 'Internet' || filter === 'Szemétszállítás'} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
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
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#f8fafc'}} />
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
                        <div className="asset-tag">{asset ? <>{asset.Category === 'car' ? '🚗' : '🏠'} {asset.FriendlyName} {asset.Category === 'car' ? `• ${asset.PlateNumber}` : ''}</> : 'Nincs eszköz'}</div>
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
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
