import React, { useState, useEffect } from 'react';
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

  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('usage'); 

  // --- FETCH FUNKCIÓ ---
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
      if (recRes.status === 401) return googleLogout();
      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
    } catch (err) { console.error("Hiba"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        setUser({ ...decoded, token: savedToken });
        setViewingUserId(decoded.sub);
        fetchAll(savedToken, decoded.sub);
      } catch (e) { googleLogout(); }
    }
  }, []);

  // --- OKOS SZŰRÉS ÉS AUTO-VÁLTÁS ---
  useEffect(() => {
    if (!selectedAssetId || selectedAssetId === 'all') return;
    
    const asset = assets.find(a => String(a.Id) === String(selectedAssetId));
    if (asset) {
      setTargetAssetId(selectedAssetId); // Rögzítő szinkron
      if (asset.category === 'car' || asset.Category === 'car') {
        setFilter('Üzemanyag');
        setDisplayMode('cost');
        setRecordMode('invoice');
        setType('Üzemanyag');
      } else {
        setFilter('Áram');
        setDisplayMode('usage');
        setRecordMode('meter');
        setType('Áram');
      }
    }
  }, [selectedAssetId, assets]);

  // Biztosítjuk, hogy a rögzítő gombjai is jól reagáljanak az eszközre
  useEffect(() => {
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    if (asset?.Category === 'car') {
      setRecordMode('invoice');
      setType('Üzemanyag');
    }
  }, [targetAssetId]);

  // --- MENTÉS ---
  const handleSave = async () => {
    if (!value || !targetAssetId) return alert("Válassz eszközt!");
    
    // Kényszerített mód választás a biztonság kedvéért
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    const isFuel = type === 'Üzemanyag' || asset?.Category === 'car';
    const finalMode = isFuel ? 'invoice' : recordMode;

    const body = { 
      type: isFuel ? 'Üzemanyag' : type,
      value: parseFloat(value), 
      amount: parseFloat(value), 
      date: (finalMode === 'invoice' || isFuel) ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };

    const res = await fetch(`${BACKEND_URL}${body.type === 'Üzemanyag' || finalMode === 'invoice' ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    
    if (res.ok) { 
      setValue(''); 
      fetchAll(user.token); 
      alert("Sikeres mentés!"); 
    } else {
      const err = await res.json();
      alert("Hiba: " + (err.details || err.error));
    }
  };

  const handleAssetSave = async () => {
    const method = editingAssetId ? 'PUT' : 'POST';
    const url = editingAssetId ? `${BACKEND_URL}/api/assets/${editingAssetId}` : `${BACKEND_URL}/api/assets`;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    setEditingAssetId(null);
    fetchAll(user.token);
  };

  // --- GRAFIKON ADATOK ---
  const getChartData = () => {
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
  };

  const chartData = getChartData();

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo">Rezsiapp 2.0</h1>
          {user && (
            <div className="user-info">
              <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠 Eszközök</button>
              <img src={user.picture} alt="Profil" onClick={() => googleLogout()} />
            </div>
          )}
        </header>

        {showAssetManager && (
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
                  <button onClick={() => { setEditingAssetId(a.Id); setNewAsset({...a}); }}>✏️</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {user && (
          <>
            <div className="top-row">
              <section className="card share-card compact">
                <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                  <option value="all">🌐 Összesített nézet</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                </select>
              </section>
            </div>

            <section className="card record-card">
              <div className="record-type-toggle">
                <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car'}>📟 Óra</button>
                <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
              </div>
              <div className="input-row">
                <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}>
                  <option value="">Eszköz...</option>
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.FriendlyName}</option>))}
                </select>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {selectedAssetId === 'all' || assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'property' ? 
                    ['Áram', 'Víz', 'Gáz', 'Internet', 'Szemétszállítás'].map(t => <option key={t} value={t}>{t}</option>) : 
                    <option value="Üzemanyag">⛽ Üzemanyag</option>
                  }
                </select>
                <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Ft" />
              </div>
              <button className="btn-primary" onClick={handleSave}>Adat mentése</button>
            </section>

            <div className="controls-bar">
              <div className="filter-buttons">
                {['Áram', 'Víz', 'Gáz', 'Üzemanyag', 'Internet', 'Szemétszállítás'].map(f => (
                  <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} onClick={() => setDisplayMode('usage')} disabled={filter === 'Üzemanyag'}>Fogyasztás</button>
                <button className={displayMode === 'cost' ? 'active' : ''} onClick={() => setDisplayMode('cost')}>Költség</button>
              </div>
            </div>

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Legend />
                      {(selectedAssetId === 'all' ? assets : assets.filter(a => String(a.Id) === String(selectedAssetId))).map((asset, index) => (
                        <Bar key={asset.Id} dataKey={asset.FriendlyName} stackId="a" fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="no-data-msg">Nincs adat</div>}
              </div>
            </section>
          </>
        )}
        {!user && <div className="card login-card"><GoogleLogin onSuccess={(res) => {
          const token = res.credential!;
          const decoded: any = jwtDecode(token);
          setUser({...decoded, token});
          localStorage.setItem('userToken', token);
          fetchAll(token, decoded.sub);
        }} /></div>}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
