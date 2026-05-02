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
  const [newAsset, setNewAsset] = useState({ category: 'property', friendlyName: '', city: '', area: '' });

  // Kategória kezelő állapotok
  const [newCategory, setNewCategory] = useState({ name: '', icon: '📄', type: 'both' });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isReadOnly = user && viewingUserId !== user.sub;

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]); setInvoices([]); setAssets([]); setCategories([]);
    localStorage.removeItem('userToken');
  };

  const fetchAll = async (token: string, targetId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes, catRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${targetId}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${targetId}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${targetId}`, { headers }),
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
    } catch (err) { console.error("Hiba"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      const decoded: any = jwtDecode(savedToken);
      setUser({ ...decoded, token: savedToken });
      setViewingUserId(decoded.sub);
    }
  }, []);

  useEffect(() => {
    if (user && viewingUserId) fetchAll(user.token, viewingUserId);
  }, [viewingUserId, user]);

  // Ha megváltozik a típus, és az csak számlát támogat, kényszerítsük a számla módot
  useEffect(() => {
    const currentCat = categories.find(c => c.Name === type);
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    
    if (currentCat?.Type === 'invoice_only' || asset?.Category === 'car') {
        setRecordMode('invoice');
    }
  }, [type, targetAssetId, categories, assets]);

  const handleAssetSave = async () => {
    if (isReadOnly || !newAsset.friendlyName) return;
    const method = editingAssetId ? 'PUT' : 'POST';
    const url = editingAssetId ? `${BACKEND_URL}/api/assets/${editingAssetId}` : `${BACKEND_URL}/api/assets`;
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    if (res.ok) {
      setEditingAssetId(null);
      setNewAsset({ category: 'property', friendlyName: '', city: '', area: '' });
      fetchAll(user.token, viewingUserId!);
    }
  };

  // Kategória mentése / módosítása
  const handleCategorySave = async () => {
    if (!isAdmin || !newCategory.name) return;
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
    if (!isAdmin || !window.confirm("Biztosan törlöd a kategóriát?")) return;
    const res = await fetch(`${BACKEND_URL}/api/categories/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }
    });
    if (res.ok) fetchAll(user.token, viewingUserId!);
  };

  const handleSave = async () => {
    if (isReadOnly || !value || !targetAssetId) return alert("Hiányzó adatok!");
    const endpoint = recordMode === 'invoice' ? '/api/invoices' : '/api/records';
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ type, value: parseFloat(value), amount: parseFloat(value), date: recordMode === 'invoice' ? invoiceDate : meterDate, assetId: parseInt(targetAssetId) })
    });
    if (res.ok) { setValue(''); fetchAll(user.token, viewingUserId!); }
  };

  const combinedList = useMemo(() => {
    const list = [
      ...records.map(r => ({ ...r, lType: 'meter', d: r.FormattedDate })),
      ...invoices.map(i => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
    ];
    return list.sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());
  }, [records, invoices]);

  const chartData = useMemo(() => {
    const dataMap: { [key: string]: any } = {};
    invoices.forEach((inv: any) => {
        const key = String(inv.Month).substring(0, 7);
        const asset = assets.find(a => String(a.Id) === String(inv.AssetId));
        const label = asset ? asset.FriendlyName : 'Egyéb';
        if (!dataMap[key]) dataMap[key] = { label: key };
        dataMap[key][label] = (dataMap[key][label] || 0) + parseFloat(inv.Amount);
    });
    return Object.values(dataMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [invoices, assets]);

  // Dinamikus kategória letiltás ellenőrzése az UI-hoz
  const currentCat = categories.find(c => c.Name === type);
  const isInvoiceOnly = currentCat?.Type === 'invoice_only' || assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car';

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo" onClick={() => setViewingUserId(user?.sub)}>Rezsiapp 2.0</h1>
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
              <button className="btn-logout" onClick={forceLogout}>Kijelentkezés</button>
            </div>
          )}
        </header>

        {user ? (
          <>
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
                  <button className="btn-primary" onClick={handleCategorySave}>Mentés</button>
                </div>
                <div className="asset-list">
                  {categories.map((c: any) => (
                    <div key={c.Id} className="asset-item">
                      <div><span>{c.Icon} {c.Name}</span> <small style={{color:'#94a3b8'}}>({c.Type === 'both' ? 'Mindkettő' : 'Csak számla'})</small></div>
                      <div>
                        <button className="btn-edit-small" onClick={() => { setEditingCategoryId(c.Id); setNewCategory({ name: c.Name, icon: c.Icon, type: c.Type }); }}>✏️</button>
                        <button className="btn-edit-small" onClick={() => handleCategoryDelete(c.Id)}>❌</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showAssetManager && !isReadOnly && (
              <section className="card asset-manager-card">
                <h3>{editingAssetId ? "Eszköz módosítása" : "Eszköz hozzáadása"}</h3>
                <div className="asset-form">
                  <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                    <option value="property">🏠 Ingatlan</option>
                    <option value="car">🚗 Jármű</option>
                  </select>
                  <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
                  <input placeholder="Város/Rendszám" value={newAsset.city} onChange={(e) => setNewAsset({...newAsset, city: e.target.value})} />
                  <button className="btn-primary" onClick={handleAssetSave}>Mentés</button>
                </div>
                <div className="asset-list">
                  {assets.map(a => (
                    <div key={a.Id} className="asset-item">
                      <div>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName} ({a.City})</div>
                      <button className="btn-edit-small" onClick={() => { setEditingAssetId(a.Id); setNewAsset({ ...a, category: a.Category, friendlyName: a.FriendlyName }); }}>✏️</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!isReadOnly && (
              <section className="card record-card">
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={isInvoiceOnly}>📟 Óraállás</button>
                  <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
                </div>
                <div className="input-row">
                  <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}>
                    <option value="">Válassz eszközt...</option>
                    {assets.map(a => <option key={a.Id} value={a.Id}>{a.FriendlyName}</option>)}
                  </select>
                  
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {categories.map(c => <option key={c.Id} value={c.Name}>{c.Icon} {c.Name}</option>)}
                  </select>

                  <input type="number" placeholder="Érték" value={value} onChange={(e) => setValue(e.target.value)} />
                  <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                </div>
                <button className="btn-primary" onClick={handleSave}>Adat rögzítése</button>
              </section>
            )}

            {isReadOnly && <div className="read-only-banner">👁️ Most <b>{sharedWithMe.find(s => s.owner_id === viewingUserId)?.owner_email}</b> adatait látod</div>}

            <section className="card chart-card">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                  <Legend />
                  {assets.map((asset, idx) => (
                    <Bar key={asset.Id} dataKey={asset.FriendlyName} stackId="a" fill={ASSET_COLORS[idx % ASSET_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="list-section">
              <h3>Előzmények</h3>
              <div className="list-container">
                {combinedList.map((item, idx) => {
                  const cIcon = categories.find(c => c.Name === item.Type)?.Icon || '📄';
                  return (
                    <div key={idx} className={`record-item ${item.lType}`}>
                      <div>
                        <strong>{item.lType === 'meter' ? '📟' : '💰'} {item.d.substring(0,10)}</strong> - {cIcon} {item.Type}
                      </div>
                      <div className="record-value">{item.Value.toLocaleString()} {item.lType === 'meter' ? 'egység' : 'Ft'}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="card login-card">
            <GoogleLogin onSuccess={(res) => {
              const token = res.credential!;
              const decoded: any = jwtDecode(token);
              setUser({...decoded, token});
              localStorage.setItem('userToken', token);
              setViewingUserId(decoded.sub);
            }} />
          </section>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
