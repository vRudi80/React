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
  const [newAsset, setNewAsset] = useState({ category: 'property', friendlyName: '', city: '' });

  const isReadOnly = user && viewingUserId !== user.sub;

  const forceLogout = () => {
    googleLogout();
    setUser(null);
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

      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      const shrData = await shareRes.json();

      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
      setSharedWithMe(Array.isArray(shrData) ? shrData : []);
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

  const handleSave = async () => {
    if (isReadOnly || !targetAssetId || !value) return;
    const body = { type, value: parseFloat(value), amount: parseFloat(value), date: recordMode === 'invoice' ? invoiceDate : meterDate, assetId: parseInt(targetAssetId) };
    const endpoint = recordMode === 'invoice' ? '/api/invoices' : '/api/records';
    
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) { setValue(''); fetchAll(user.token, viewingUserId!); }
  };

  const handleAssetSave = async () => {
    if (isReadOnly || !newAsset.friendlyName) return;
    const res = await fetch(`${BACKEND_URL}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newAsset)
    });
    if (res.ok) { setNewAsset({ category: 'property', friendlyName: '', city: '' }); fetchAll(user.token, viewingUserId!); }
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
              <button className="btn-asset-toggle" onClick={() => setShowAssetManager(!showAssetManager)}>🏠 Eszközök</button>
              <img src={user.picture} alt="Profil" />
              <button className="btn-logout" onClick={forceLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {user ? (
          <>
            {showAssetManager && !isReadOnly && (
              <section className="card asset-manager-card">
                <h3>Eszköz hozzáadése</h3>
                <div className="asset-form">
                  <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
                  <input placeholder="Város" value={newAsset.city} onChange={(e) => setNewAsset({...newAsset, city: e.target.value})} />
                  <button className="btn-primary" onClick={handleAssetSave}>Mentés</button>
                </div>
                <div className="asset-list">
                  {assets.map(a => <div key={a.Id} className="asset-item">{a.FriendlyName} ({a.City})</div>)}
                </div>
              </section>
            )}

            {!isReadOnly && (
              <section className="card record-card">
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')}>📟 Óraállás</button>
                  <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')}>💰 Számla</button>
                </div>
                <div className="input-row">
                  <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}>
                    <option value="">Válassz eszközt...</option>
                    {assets.map(a => <option key={a.Id} value={a.Id}>{a.FriendlyName}</option>)}
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
                {combinedList.map((item, idx) => (
                  <div key={idx} className={`record-item ${item.lType}`}>
                    <div>
                      <strong>{item.lType === 'meter' ? '📟' : '💰'} {item.d.substring(0,10)}</strong> - {item.Type}
                    </div>
                    <div className="record-value">{item.Value.toLocaleString()} {item.lType === 'meter' ? 'egység' : 'Ft'}</div>
                  </div>
                ))}
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
