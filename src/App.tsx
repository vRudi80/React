import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import './App.css';

const BACKEND_URL = "https://react-ideas-backend.onrender.com";
const GOOGLE_CLIENT_ID = "197361744572-ih728hq5jft3fqfd1esvktvrd8i97kcp.apps.googleusercontent.com";
const ASSET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ⚠️ IDE ÍRD BE A SAJÁT E-MAIL CÍMEDET!
const ADMIN_EMAILS = ['kovari.rudolf@gmail.com']; 

function App() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  
  const [recordMode, setRecordMode] = useState<'meter' | 'invoice'>('meter');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [meterDate, setMeterDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  const [showAssetManager, setShowAssetManager] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  
  const [newAsset, setNewAsset] = useState({ category: 'property', friendlyName: '', city: '', street: '', houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' });
  const [newCategory, setNewCategory] = useState({ name: '', icon: '📄', type: 'both' });

  // VISSZAÁLLÍTVA: Eredeti UI állapotok
  const [filter, setFilter] = useState('Összes');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('cost');

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isReadOnly = user && viewingUserId !== user.sub;

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]); setInvoices([]); setAssets([]); setCategories([]);
    localStorage.removeItem('userToken');
  };

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes, catRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/categories`, { headers }),
        fetch(`${BACKEND_URL}/api/shares/me`, { headers })
      ]);

      if (recRes.status === 401) return forceLogout();
      
      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      const catData = await catRes.json();
      const shrData = await shareRes.json();

      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
      setCategories(Array.isArray(catData) ? catData : []);
      setSharedWithMe(Array.isArray(shrData) ? shrData : []);

      if (catData.length > 0 && !type) setType(catData[0].Name);
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

  useEffect(() => {
    if (user && viewingUserId) {
      fetchAll(user.token, viewingUserId);
      setSelectedAssetId('all');
    }
  }, [viewingUserId]);

  const getAllowedTypes = (assetId: string) => {
    if (!assetId || assetId === 'all') return categories.map(c => c.Name);
    const asset = assets.find((a: any) => String(a.Id) === String(assetId));
    if (asset?.Category === 'property') {
        return categories.map(c => c.Name);
    } else {
        return categories.filter(c => c.Name === 'Üzemanyag').map(c => c.Name);
    }
  };

  // VISSZAÁLLÍTVA: Automatikus szűrő és típus beállítások
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
    const currentCat = categories.find(c => c.Name === type);
    
    if (currentCat?.Type === 'invoice_only' || asset?.Category === 'car') {
      setRecordMode('invoice');
    }
    if (allowed.length > 0 && !allowed.includes(type)) setType(allowed[0]);
  }, [targetAssetId, type, assets, categories]);

  // VISSZAÁLLÍTVA: Megosztás funkció (Sajátból)
  const handleShare = async () => {
    if (!shareEmail) return;
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ sharedWithEmail: shareEmail })
    });
    if (res.ok) { alert("Sikeresen megosztva!"); setShareEmail(''); }
  };

  const handleAssetSave = async () => {
    if (isReadOnly || !newAsset.friendlyName) return alert("Adj nevet az eszköznek!");
    const method = editingAssetId ? 'PUT' : 'POST';
    const url = editingAssetId ? `${BACKEND_URL}/api/assets/${editingAssetId}` : `${BACKEND_URL}/api/assets`;
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    if (res.ok) {
      setEditingAssetId(null);
      setNewAsset({ category: 'property', friendlyName: '', city: '', street: '', houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' });
      setShowAssetManager(false);
      fetchAll(user.token, viewingUserId!);
    }
  };

  const handleCategorySave = async () => {
    if (!isAdmin) return;
    const url = editingCategoryId ? `${BACKEND_URL}/api/categories/${editingCategoryId}` : `${BACKEND_URL}/api/categories`;
    const res = await fetch(url, {
      method: editingCategoryId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newCategory)
    });
    if (res.ok) {
      setEditingCategoryId(null);
      setNewCategory({ name: '', icon: '📄', type: 'both' });
      fetchAll(user.token, viewingUserId!);
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!isAdmin || !window.confirm("Biztos törlöd a kategóriát?")) return;
    const res = await fetch(`${BACKEND_URL}/api/categories/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }
    });
    if (res.ok) fetchAll(user.token, viewingUserId!);
  };

  const handleSave = async () => {
    if (isReadOnly || !value || !targetAssetId) return alert("Válassz eszközt!");
    const currentCat = categories.find(c => c.Name === type);
    const isInvoiceType = currentCat?.Type === 'invoice_only';

    const body = { 
      type, 
      value: parseFloat(value), 
      amount: parseFloat(value), 
      date: (recordMode === 'invoice' || isInvoiceType) ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };

    const endpoint = (recordMode === 'invoice' || isInvoiceType) ? '/api/invoices' : '/api/records';
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token, viewingUserId!); } 
    else { alert("Hiba történt a mentés során."); }
  };

  // VISSZAÁLLÍTVA: Eredeti ikon és szín generátorok, integrálva a dinamikus kategóriákkal
  const getIcon = (t: string) => {
    if (t === 'Összes') return '📊';
    const cat = categories.find(c => c.Name === t);
    return cat ? cat.Icon : '📄';
  };

  const getColor = (t: string = filter) => {
    if (displayMode === 'cost' && t !== 'Összes') return '#10b981';
    if (t === 'Összes') return '#6366f1';
    
    // Alapértelmezett színek, ha véletlen egyezik a név
    switch(t) {
      case 'Áram': return '#fbbf24';
      case 'Víz': return '#38bdf8';
      case 'Gáz': return '#f87171';
      case 'Üzemanyag': return '#a855f7';
      case 'Internet': return '#ec4899';
      case 'Szemétszállítás': return '#94a3b8';
      case 'Albérlet': return '#f472b6';
      default: 
        // Generáljunk egy színt a név alapján az új kategóriáknak
        let hash = 0;
        for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
        return `hsl(${hash % 360}, 70%, 60%)`;
    }
  };

  // VISSZAÁLLÍTVA: Eredeti kombinált lista
  const combinedList = [
    ...(filter === 'Összes' ? [] : records.filter(r => (selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId)) && r.Type === filter).map(r => ({ ...r, lType: 'meter', d: r.FormattedDate }))),
    ...invoices.filter(i => (selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId)) && (filter === 'Összes' ? true : i.Type === filter)).map(i => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
  ].sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());

  // VISSZAÁLLÍTVA: Eredeti részletes grafikon logika (Költség/Fogyasztás, Havi/Éves)
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

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo" onClick={() => { setViewingUserId(user?.sub); setFilter('Összes'); setDisplayMode('cost'); }}>Rezsiapp 2.0</h1>
          {user && (
            <div className="user-info">
              <select className="profile-selector" value={viewingUserId || ''} onChange={(e) => setViewingUserId(e.target.value)}>
                <option value={user.sub}>Saját fiók</option>
                {sharedWithMe.map(s => <option key={s.owner_id} value={s.owner_id}>👥 {s.owner_email}</option>)}
              </select>
              {isAdmin && (
                <button className="btn-asset-toggle" onClick={() => { setShowCategoryManager(!showCategoryManager); setShowAssetManager(false); }}>⚙️ Kategóriák</button>
              )}
              <button className="btn-asset-toggle" onClick={() => { setShowAssetManager(!showAssetManager); setShowCategoryManager(false); }}>🏠 Eszközök</button>
              <img src={user.picture} alt="Profil" title={user.email} />
              <button className="btn-logout" onClick={forceLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {showCategoryManager && isAdmin && (
          <section className="card asset-manager-card">
            <h3>Kategóriák karbantartása</h3>
            <div className="asset-form">
              <input placeholder="Ikon (pl. ⚡)" value={newCategory.icon} onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})} style={{width: '60px'}}/>
              <input placeholder="Kategória neve" value={newCategory.name} onChange={(e) => setNewCategory({...newCategory, name: e.target.value})} />
              <select value={newCategory.type} onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}>
                <option value="both">📟 Óraállás + 💰 Számla</option>
                <option value="invoice_only">Csak 💰 Számla</option>
              </select>
              <div className="asset-form-buttons">
                <button className="btn-primary" onClick={handleCategorySave}>Mentés</button>
              </div>
            </div>
            <div className="asset-list">
              {categories.map((c: any) => (
                <div key={c.Id} className="asset-item">
                  <div className="asset-item-info">
                    <span>{c.Icon} {c.Name}</span> 
                    <small>({c.Type === 'both' ? 'Mindkettő' : 'Csak számla'})</small>
                  </div>
                  <div>
                    <button className="btn-edit-small" onClick={() => { setEditingCategoryId(c.Id); setNewCategory({ name: c.Name, icon: c.Icon, type: c.Type }); }}>✏️</button>
                    <button className="btn-edit-small" onClick={() => handleCategoryDelete(c.Id)}>❌</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {showAssetManager && user && !isReadOnly && (
          <section className="card asset-manager-card">
            <h3>{editingAssetId ? "Eszköz módosítása" : "Új eszköz"}</h3>
            <div className="asset-form">
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                <option value="property">🏠 Ingatlan</option>
                <option value="car">🚗 Jármű</option>
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
                {editingAssetId && <button className="btn-secondary" onClick={() => setEditingAssetId(null)}>Mégse</button>}
              </div>
            </div>
            <div className="asset-list">
              {assets.map((a: any) => (
                <div key={a.Id} className="asset-item">
                  <div className="asset-item-info">
                    <span>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</span>
                    <small>{a.Category === 'car' ? a.PlateNumber : a.City}</small>
                  </div>
                  <button className="btn-edit-small" onClick={() => { setEditingAssetId(a.Id); setNewAsset({ ...a, category: a.Category, friendlyName: a.FriendlyName }); }}>✏️</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {user ? (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített nézet</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                {!isReadOnly && (
                  <div className="share-input-group">
                    <input type="email" placeholder="Megosztás (email)..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                    <button className="btn-share" onClick={handleShare}>+</button>
                  </div>
                )}
              </section>
            </div>

            {isReadOnly && <div className="read-only-banner">👁️ Most <b>{sharedWithMe.find(s => s.owner_id === viewingUserId)?.owner_email}</b> adatait látod</div>}

            {!isReadOnly && (
              <section className="card record-card">
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={categories.find(c => c.Name === type)?.Type === 'invoice_only' || assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car'}>📟 Óraállás</button>
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
                  <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Ft" />
                </div>
                <button className="btn-primary" onClick={handleSave}>Adat mentése</button>
              </section>
            )}

            {/* VISSZAÁLLÍTVA: Vezérlők (Szűrők, Nézetek) */}
            <div className="controls-bar">
              <div className="filter-buttons">
                {categories.map(c => (
                  <button key={c.Id} className={filter === c.Name ? 'active' : ''} onClick={() => setFilter(c.Name)} style={filter === c.Name ? {backgroundColor: getColor(c.Name), borderColor: getColor(c.Name)} : {}}>
                    {c.Icon} {c.Name}
                  </button>
                ))}
                {displayMode === 'cost' && (
                  <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>
                    {getIcon('Összes')} Összes
                  </button>
                )}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={categories.find(c => c.Name === filter)?.Type === 'invoice_only' || filter === 'Összes'} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
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
                ) : <div className="no-data-msg">Nincs megjeleníthető adat a kiválasztott szűrőkkel</div>}
              </div>
            </section>

            {/* VISSZAÁLLÍTVA: Eredeti részletes lista */}
            <section className="list-section">
              <div className="list-container">
                {combinedList.map((item: any, idx) => {
                  const asset = assets.find(a => String(a.Id) === String(item.AssetId));
                  return (
                    <div key={idx} className={`record-item ${item.lType === 'invoice' ? 'invoice' : ''}`}>
                      <div className="record-info">
                        <div className="record-main-line">
                          <span>{item.lType === 'meter' ? '📟' : '💰'} {String(item.d).substring(0, 10)} ({getIcon(item.Type)} {item.Type})</span>
                        </div>
                        <div className="asset-tag">{asset ? <>{asset.Category === 'car' ? '🚗' : '🏠'} {asset.FriendlyName}</> : 'Nincs eszköz'}</div>
                      </div>
                      <div className="record-value-container">
                        <span className="record-value">{(parseFloat(item.Value) || 0).toLocaleString()} {item.lType === 'meter' ? 'egység' : 'Ft'}</span>
                        {!isReadOnly && (
                          <button className="btn-delete" onClick={async () => { if(window.confirm("Törlöd?")) { await fetch(`${BACKEND_URL}/api/${item.lType === 'meter' ? 'records' : 'invoices'}/${item.Id || item.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }); fetchAll(user.token, viewingUserId!); } }}>❌</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          /* VISSZAÁLLÍTVA: Eredeti szép belépő kártya */
          <section className="card login-card">
            <h2>Üdvözöllek a Rezsiappban!</h2>
            <p className="login-desc">Kövesd nyomon ingatlanjaid és járműveid rezsi-, valamint üzemanyag költségeit egyetlen helyen. A folytatáshoz kérlek jelentkezz be.</p>
            <div className="google-btn-container">
              <GoogleLogin onSuccess={(res) => { 
                const token = res.credential!; 
                const decoded: any = jwtDecode(token); 
                setUser({...decoded, token}); 
                localStorage.setItem('userToken', token); 
                setViewingUserId(decoded.sub);
                fetchAll(token, decoded.sub); 
              }} />
            </div>
          </section>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
