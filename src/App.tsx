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
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  
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

  const isReadOnly = viewingUserId !== null && viewingUserId !== user?.sub;

  const [myShares, setMyShares] = useState<any[]>([]); // Akikkel ÉN osztottam meg

  // Saját megosztások lekérése
  const fetchMyShares = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/owned`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setMyShares(await res.json());
    } catch (e) { console.error("Hiba", e); }
  };

  // Megosztás törlése
  const revokeShare = async (id: number) => {
    if (!window.confirm("Biztosan visszavonod a hozzáférést?")) return;
    const res = await fetch(`${BACKEND_URL}/api/shares/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user.token}` }
    });
    if (res.ok) fetchMyShares(user.token);
  };
  // --- FUNKCIÓK ---

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    setInvoices([]);
    setAssets([]);
    setSharedUsers([]);
    localStorage.removeItem('userToken');
  };

  // --- EZT AZ ÚJ FÜGGVÉNYT ADD HOZZÁ IDE ---
  const handleLoginSuccess = async (token: string) => {
    try {
      const decoded: any = jwtDecode(token);
      setUser({ ...decoded, token });
      setViewingUserId(decoded.sub);
      localStorage.setItem('userToken', token);
      
      // 1. Alapadatok és a megosztások lekérése
      fetchAll(token, decoded.sub);
      fetchSharedAccounts(token);
      fetchMyShares(token);

      // 2. Belépés naplózása az adatbázisba (users tábla)
      await fetch(`${BACKEND_URL}/api/login-sync`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        }
      });
    } catch (e) {
      console.error("Hiba a bejelentkezés feldolgozásakor", e);
      forceLogout();
    }
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
    } catch (err) { console.error("Adatlekérési hiba"); }
  };

  const fetchSharedAccounts = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSharedUsers(await res.json());
    } catch (e) { console.error("Hiba a megosztások lekérésekor", e); }
  };

useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      handleLoginSuccess(savedToken);
    }
  }, []);

  const getAllowedTypes = (assetId: string) => {
    if (!assetId || assetId === 'all') return ['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'];
    const asset = assets.find((a: any) => String(a.Id) === String(assetId));
    return asset?.Category === 'property' ? ['Áram', 'Víz', 'Gáz', 'Internet', 'Szemétszállítás', 'Albérlet'] : ['Üzemanyag'];
  };

  useEffect(() => {
    if (selectedAssetId !== 'all') {
      setTargetAssetId(selectedAssetId);
      const asset = assets.find(a => String(a.Id) === String(selectedAssetId));
      if (asset?.Category === 'car') {
        setFilter('Üzemanyag');
        setDisplayMode('cost');
      }
    } else {
      setFilter('Összes');
      setDisplayMode('cost');
    }
  }, [selectedAssetId, assets.length]);

  useEffect(() => {
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    const allowed = getAllowedTypes(targetAssetId);
    
    if (asset?.Category === 'car' || ['Internet', 'Szemétszállítás', 'Albérlet'].includes(type)) {
      setRecordMode('invoice');
    }
    
    if (!allowed.includes(type)) setType(allowed[0]);
  }, [targetAssetId, type, assets]);

 // --- GRAFIKON ADATOK ---

  const chartData = useMemo(() => {
    const dataMap: { [key: string]: any } = {};
    const fRec = records.filter((r: any) => selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId));
    const fInv = invoices.filter((i: any) => selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId));

    if (displayMode === 'usage') {
      // 1. Eszközönként csoportosítjuk az adatokat, hogy ne vonjunk ki egymásból különböző mérőórákat
      const assetsMap: { [key: string]: any[] } = {};
      fRec.filter((r: any) => filter === 'Összes' ? true : r.Type === filter).forEach((r: any) => {
        if (!assetsMap[r.AssetId]) assetsMap[r.AssetId] = [];
        assetsMap[r.AssetId].push(r);
      });

      Object.keys(assetsMap).forEach(assetId => {
        // Időrendbe állítjuk az adott eszközhöz tartozó mérőállásokat
        const filtered = assetsMap[assetId].sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
        
        for (let i = 1; i < filtered.length; i++) {
          const diff = parseFloat(filtered[i].Value) - parseFloat(filtered[i-1].Value);
          if (diff >= 0) {
            // JAVÍTÁS: A két óraállás közötti időszak KÖZEPÉT (midpoint) vesszük alapul.
            // Így mindegy, hogy elsején vagy hónap végén olvasod le, a fogyasztás a megfelelő hónaphoz kerül.
            const t1 = new Date(filtered[i-1].FormattedDate).getTime();
            const t2 = new Date(filtered[i].FormattedDate).getTime();
            const midDate = new Date(t1 + (t2 - t1) / 2);
            
            const year = midDate.getFullYear();
            const month = String(midDate.getMonth() + 1).padStart(2, '0');
            const key = viewMode === 'monthly' ? `${year}-${month}` : `${year}`;
            
            const asset = assets.find(a => String(a.Id) === String(assetId));
            const label = asset ? asset.FriendlyName : 'Egyéb';
            
            if (!dataMap[key]) dataMap[key] = { label: key };
            dataMap[key][label] = (dataMap[key][label] || 0) + diff;
          }
        }
      });
    } else {
      const keyLen = viewMode === 'monthly' ? 7 : 4;
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

  // --- EGYEDI TOOLTIP A GRAFIKONHOZ ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Összeadjuk az aktuális oszlop (hónap/év) értékeit
      const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
      const unit = displayMode === 'cost' ? 'Ft' : '';

      return (
        <div style={{ backgroundColor: '#1e293b', padding: '12px', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{label}</p>
          
          {/* Elemek listázása */}
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span style={{ fontWeight: 600 }}>{Number(entry.value).toLocaleString()} {unit}</span>
            </div>
          ))}
          
          {/* Végösszeg megjelenítése */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.95rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155', fontWeight: 'bold', color: '#10b981' }}>
            <span>Összesen:</span>
            <span>{total.toLocaleString()} {unit}</span>
          </div>
        </div>
      );
    }
    return null;
  };
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
    if (res.ok) {
      setEditingAssetId(null);
      setNewAsset({ category: 'property', friendlyName: '', city: '', street: '', houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' });
      setShowAssetManager(false);
      fetchAll(user.token);
    }
  };

  const handleSave = async () => {
    // 1. Validáció: külön hibaüzenet az eszközre és az értékre
    if (!targetAssetId || targetAssetId === 'all') {
      return alert("Kérlek, válassz ki egy konkrét eszközt a mentéshez!");
    }
    if (!value) {
      return alert("Kérlek, add meg az értéket!");
    }
    
    const isInvoiceType = ['Üzemanyag', 'Internet', 'Szemétszállítás', 'Albérlet'].includes(type);
    
    const body = { 
      type, 
      value: parseFloat(value), 
      amount: parseFloat(value), 
      date: (recordMode === 'invoice' || isInvoiceType) ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };

    const res = await fetch(`${BACKEND_URL}${recordMode === 'invoice' || isInvoiceType ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    
    if (res.ok) { 
      setValue(''); 
      fetchAll(user.token); 
    } else {
      alert("Hiba történt a mentés során.");
    }
  };

  const handleShare = async () => {
    if (!shareEmail) return alert("Kérlek adj meg egy email címet!");
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ sharedWithEmail: shareEmail })
    });
    if (res.ok) {
      alert("Sikeres megosztás!");
      setShareEmail('');
      fetchMyShares(user.token);
    } else {
      alert("Hiba történt a megosztás során.");
    }
  };

  const getIcon = (t: string) => {
    switch(t) {
      case 'Áram': return '⚡';
      case 'Víz': return '💧';
      case 'Gáz': return '🔥';
      case 'Üzemanyag': return '⛽';
      case 'Internet': return '🌐'; 
      case 'Szemétszállítás': return '🗑️';
      case 'Albérlet': return '🏠';
      case 'Összes': return '📊';
      default: return '📄';
    }
  };

  const getColor = (t: string = filter) => {
    if (displayMode === 'cost' && t !== 'Összes') return '#10b981';
    if (t === 'Összes') return '#6366f1';
    switch(t) {
      case 'Áram': return '#fbbf24';
      case 'Víz': return '#38bdf8';
      case 'Gáz': return '#f87171';
      case 'Üzemanyag': return '#a855f7';
      case 'Internet': return '#ec4899';
      case 'Szemétszállítás': return '#94a3b8';
      case 'Albérlet': return '#f472b6';
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
              {!isReadOnly && <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠 Eszközök</button>}
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={forceLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {showAssetManager && user && !isReadOnly && (
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
                  {/* 1. JAVÍTÁS: Csak a név jelenik meg, kivettük a <small> taget a város/rendszám miatt */}
                  <div className="asset-item-info">
                    <span>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</span>
                  </div>
                  
                  {/* 2. JAVÍTÁS: Összekötöttük a backend nagybetűs mezőit a frontend kisbetűs mezőivel */}
                  <button className="btn-edit-small" onClick={() => { 
                    setEditingAssetId(a.Id);
                    setNewAsset({ 
                      category: a.Category || 'property', 
                      friendlyName: a.FriendlyName || '',
                      city: a.City || '',
                      street: a.Street || '',
                      houseNumber: a.HouseNumber || '',
                      plateNumber: a.PlateNumber || '',
                      fuelType: a.FuelType || 'Benzin',
                      area: a.Area || ''
                    });
                  }}>✏️</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {user ? (
          <>
            <div className="top-row" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <section className="card share-card compact">
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített nézet</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                
                  {!isReadOnly && (
                  <>
                    <div className="share-input-group">
                      <input type="email" placeholder="Kivel osztod meg?" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                      <button className="btn-share" onClick={handleShare}>+</button>
                    </div>
                    
                    {/* ÚJ: Megosztottak listája */}
                    {myShares.length > 0 && (
                      <div className="shared-list" style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px' }}>Hozzáféréssel rendelkeznek:</p>
                        {myShares.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', fontSize: '0.85rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.shared_with_email}</span>
                            <button 
                              onClick={() => revokeShare(s.id)}
                              style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Visszavonás
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {sharedUsers.length > 0 && (
                <section className="card share-card compact">
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Nézet:</label>
                  <select value={viewingUserId || user?.sub} onChange={(e) => {
                    setViewingUserId(e.target.value);
                    setSelectedAssetId('all');
                    fetchAll(user.token, e.target.value);
                  }}>
                    <option value={user?.sub}>Saját adataim</option>
                    {sharedUsers.map(su => (
                      <option key={su.owner_id} value={su.owner_id}>{su.owner_email} adatai</option>
                    ))}
                  </select>
                </section>
              )}
            </div>

            {!isReadOnly && (
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
               <button 
  className="btn-primary" 
  onClick={handleSave} 
  disabled={!targetAssetId || targetAssetId === 'all' || !value}
>
  Adat mentése
</button>
              </section>
            )}

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
                     <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
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
                        {!isReadOnly && (
                          <button className="btn-delete" onClick={async () => { if(window.confirm("Törlöd?")) { await fetch(`${BACKEND_URL}/api/${item.lType === 'meter' ? 'records' : 'invoices'}/${item.Id || item.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }); fetchAll(user.token); } }}>❌</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
      ) : (
          <div className="login-container">
            <div className="login-content">
              <h1 className="login-title">Üdvözöl a <span className="highlight">Rezsiapp 2.0</span></h1>
              <p className="login-subtitle">A legkényelmesebb módja a háztartási kiadások, mérőóra állások és az autód költségeinek nyomon követésére.</p>

              <div className="features-grid">
                <div className="feature-item">
                  <span className="feature-icon">📊</span>
                  <div className="feature-text">
                    <h3>Vizuális statisztikák</h3>
                    <p>Kövesd a fogyasztásod havi vagy éves szinten, átlátható és letisztult grafikonokon.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🏠</span>
                  <div className="feature-text">
                    <h3>Ingatlanok és Járművek</h3>
                    <p>Kezeld külön a lakásod rezsijét és az autód tankolásait, mindezt egyetlen helyen.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🤝</span>
                  <div className="feature-text">
                    <h3>Családi megosztás</h3>
                    <p>Oszd meg az adataidat a pároddal vagy lakótársaddal biztonságosan, egyetlen kattintással.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="login-action-card">
              <h2>Kezdd el most!</h2>
              <p>A belépéshez nincs szükség külön regisztrációra, csak használd a meglévő Google fiókodat biztonságosan.</p>
              <div className="google-btn-wrapper">
                <GoogleLogin onSuccess={(res) => handleLoginSuccess(res.credential!)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
