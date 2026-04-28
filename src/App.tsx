import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
  
  // KI AZT LÁTJUK ÉPPEN?
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const isReadOnly = user && viewingUserId !== user.sub;

  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  const [recordMode, setRecordMode] = useState<'meter' | 'invoice'>('meter');
  const [targetAssetId, setTargetAssetId] = useState('');
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [meterDate, setMeterDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [shareEmail, setShareEmail] = useState('');
  const [showAssetManager, setShowAssetManager] = useState(false);

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    setInvoices([]);
    setAssets([]);
    localStorage.removeItem('userToken');
  };

  const fetchAll = async (token: string, targetId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes, shareRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${targetId}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${targetId}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${targetId}`, { headers }),
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
    } catch (err) { console.error("Hiba az adatok letöltésekor"); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      const decoded: any = jwtDecode(savedToken);
      setUser({ ...decoded, token: savedToken });
      setViewingUserId(decoded.sub);
      fetchAll(savedToken, decoded.sub);
    }
  }, []);

  // Profil váltáskor újratöltés
  useEffect(() => {
    if (user && viewingUserId) {
        fetchAll(user.token, viewingUserId);
        setSelectedAssetId('all');
    }
  }, [viewingUserId]);

  const handleShare = async () => {
    if (!shareEmail) return;
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ sharedWithEmail: shareEmail })
    });
    if (res.ok) { alert("Megosztva!"); setShareEmail(''); }
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!value || !targetAssetId) return alert("Hiányzó adatok!");
    
    const body = { 
      type, 
      value: parseFloat(value), 
      amount: parseFloat(value), 
      date: recordMode === 'invoice' ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };

    const res = await fetch(`${BACKEND_URL}${recordMode === 'invoice' ? '/api/invoices' : '/api/records'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token, viewingUserId!); }
  };

  // --- Grafikon adatok (marad a régi logika, de az új adatokkal) ---
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: any } = {};
    const fInv = invoices.filter((i: any) => selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId));
    
    fInv.forEach((inv: any) => {
        const key = String(inv.Month).substring(0, 7);
        const asset = assets.find(a => String(a.Id) === String(inv.AssetId));
        const label = asset ? asset.FriendlyName : 'Egyéb';
        if (!dataMap[key]) dataMap[key] = { label: key };
        dataMap[key][label] = (dataMap[key][label] || 0) + parseFloat(inv.Amount);
    });
    return Object.values(dataMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [invoices, assets, selectedAssetId]);

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
              <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠</button>
              <img src={user.picture} alt="Profil" title={user.email} />
              <button className="btn-logout" onClick={forceLogout}>Kijelentkezés</button>
            </div>
          )}
        </header>

        {user ? (
          <>
            <section className="card share-card">
                <h3>{isReadOnly ? "Megtekintett fiók eszközei" : "Saját eszközeim"}</h3>
                <div className="top-controls">
                    <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                        <option value="all">🌐 Összesített nézet</option>
                        {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : '🏠'} {a.FriendlyName}</option>))}
                    </select>
                    {!isReadOnly && (
                        <div className="share-box">
                            <input placeholder="Megosztás (email)..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                            <button onClick={handleShare}>+</button>
                        </div>
                    )}
                </div>
            </section>

            {/* RÖGZÍTŐ CSAK SAJÁT PROFILNÁL LÁTSZIK */}
            {!isReadOnly && (
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
                        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Ft" />
                        <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                    </div>
                    <button className="btn-primary" onClick={handleSave}>Mentés</button>
                </section>
            )}

            {isReadOnly && <div className="read-only-banner">👁️ Most <b>{sharedWithMe.find(s => s.owner_id === viewingUserId)?.owner_email}</b> adatait látod</div>}

            <section className="card chart-card">
              <div style={{ width: '100%', height: 300 }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="label" fontSize={10} stroke="#94a3b8" />
                      <YAxis fontSize={10} stroke="#94a3b8" />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none'}} />
                      <Legend />
                      {assets.map((asset, idx) => (
                        <Bar key={asset.Id} dataKey={asset.FriendlyName} stackId="a" fill={ASSET_COLORS[idx % ASSET_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="no-data-msg">Nincs megjeleníthető költség adat</div>}
              </div>
            </section>
          </>
        ) : (
          <section className="card login-card">
              <h2>Üdvözöllek a Rezsiappban!</h2>
              <p>A folytatáshoz jelentkezz be Google fiókoddal.</p>
              <GoogleLogin onSuccess={(res) => {
                  const token = res.credential!;
                  const decoded: any = jwtDecode(token);
                  setUser({...decoded, token});
                  localStorage.setItem('userToken', token);
                  setViewingUserId(decoded.sub);
                  fetchAll(token, decoded.sub);
              }} />
          </section>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
