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

const ADMIN_EMAILS = ['kovari.rudolf@gmail.com']; 

function App() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [myShares, setMyShares] = useState<any[]>([]); 
  
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
  
  const [editingRecordId, setEditingRecordId] = useState<number | string | null>(null);
  const [editingRecordLType, setEditingRecordLType] = useState<'meter' | 'invoice' | null>(null);
  
  const [newAsset, setNewAsset] = useState({ 
    category: 'property', friendlyName: '', city: '', street: '', 
    houseNumber: '', plateNumber: '', fuelType: 'Benzin', area: '' 
  });
  
  const [newCategory, setNewCategory] = useState({ name: '', icon: '📄', type: 'both', isPublic: false });

  const [filter, setFilter] = useState('Összes');
  const [viewMode, setViewMode] = useState('monthly'); 
  const [displayMode, setDisplayMode] = useState('cost');
  
  const [chartRange, setChartRange] = useState<number | 'all' | 'custom'>(12); 
  const [customStartDate, setCustomStartDate] = useState<string>('2024-01');
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().substring(0, 7));

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isReadOnly = viewingUserId !== null && viewingUserId !== user?.sub;

  // --- LEKÉRDEZÉSEK ---

  const fetchMyShares = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/owned`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setMyShares(await res.json());
    } catch (e) { console.error("Hiba", e); }
  };

  const fetchSharedAccounts = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSharedUsers(await res.json());
    } catch (e) { console.error("Hiba a megosztások lekérésekor", e); }
  };

  const fetchAll = async (token: string, targetId?: string) => {
    const id = targetId || viewingUserId || user?.sub;
    if (!id || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [recRes, invRes, assetRes, catRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/records?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/invoices?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/assets?userId=${id}`, { headers }),
        fetch(`${BACKEND_URL}/api/categories?userId=${id}`, { headers })
      ]);
      if (recRes.status === 401) return forceLogout();
      
      const recData = await recRes.json();
      const invData = await invRes.json();
      const astData = await assetRes.json();
      const catData = await catRes.json();
      
      setRecords(Array.isArray(recData) ? recData : []);
      setInvoices(Array.isArray(invData) ? invData : []);
      setAssets(Array.isArray(astData) ? astData : []);
      
      const loadedCategories = Array.isArray(catData) ? catData : [];
      setCategories(loadedCategories);
      
      if (loadedCategories.length > 0 && !type) {
        setType(loadedCategories[0].Name);
      }
    } catch (err) { console.error("Adatlekérési hiba"); }
  };

  const handleLoginSuccess = async (token: string) => {
    try {
      const decoded: any = jwtDecode(token);
      setUser({ ...decoded, token });
      setViewingUserId(decoded.sub);
      localStorage.setItem('userToken', token);
      
      fetchAll(token, decoded.sub);
      fetchSharedAccounts(token);
      fetchMyShares(token);

      await fetch(`${BACKEND_URL}/api/login-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.error("Hiba a bejelentkezés", e);
      forceLogout();
    }
  };

  const forceLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]); setInvoices([]); setAssets([]); setCategories([]);
    setSharedUsers([]); setMyShares([]);
    localStorage.removeItem('userToken');
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) handleLoginSuccess(savedToken);
  }, []);

  const getAllowedTypes = (assetId: string) => {
    const allCatNames = categories.map(c => c.Name);
    if (!assetId || assetId === 'all') return allCatNames;
    const asset = assets.find((a: any) => String(a.Id) === String(assetId));
    if (asset?.Category === 'property' || asset?.Category === 'person') return allCatNames;
    return allCatNames.includes('Üzemanyag') ? ['Üzemanyag'] : allCatNames;
  };

  useEffect(() => {
    if (selectedAssetId !== 'all') {
      if (!editingRecordId) setTargetAssetId(selectedAssetId);
      const asset = assets.find(a => String(a.Id) === String(selectedAssetId));
      if (asset?.Category === 'car') {
        if (categories.find(c => c.Name === 'Üzemanyag')) setFilter('Üzemanyag');
        setDisplayMode('cost');
      }
    } else {
      setFilter('Összes');
      setDisplayMode('cost');
    }
  }, [selectedAssetId, assets.length, categories, editingRecordId]);

  useEffect(() => {
    const asset = assets.find(a => String(a.Id) === String(targetAssetId));
    const allowed = getAllowedTypes(targetAssetId);
    const currentCat = categories.find(c => c.Name === type);
    
    if (!editingRecordId) {
      if (asset?.Category === 'car' || currentCat?.Type === 'invoice_only' || currentCat?.Type === 'income') {
        setRecordMode('invoice');
      }
    }
    
    if (allowed.length > 0 && !allowed.includes(type)) setType(allowed[0]);
  }, [targetAssetId, type, assets, categories, editingRecordId]);

  const chartData = useMemo(() => {
    const dataMap: { [key: string]: any } = {};
    const fRec = records.filter((r: any) => selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId));
    const fInv = invoices.filter((i: any) => selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId));

    if (displayMode === 'usage') {
      const assetsMap: { [key: string]: any[] } = {};
      fRec.filter((r: any) => {
        if (filter === 'Összes' || filter === 'Összes kiadás') return true;
        return r.Type === filter;
      }).forEach((r: any) => {
        if (!assetsMap[r.AssetId]) assetsMap[r.AssetId] = [];
        assetsMap[r.AssetId].push(r);
      });

      Object.keys(assetsMap).forEach(assetId => {
        const filtered = assetsMap[assetId].sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());
        for (let i = 1; i < filtered.length; i++) {
          const diff = parseFloat(filtered[i].Value) - parseFloat(filtered[i-1].Value);
          if (diff >= 0) {
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
      fInv.filter((inv: any) => {
        if (filter === 'Összes') return true;
        if (filter === 'Összes kiadás') {
          const isInc = categories.find(c => c.Name === inv.Type)?.Type === 'income';
          return !isInc;
        }
        return inv.Type === filter;
      }).forEach((inv: any) => {
        const key = String(inv.Month || "").substring(0, keyLen);
        const asset = assets.find(a => String(a.Id) === String(inv.AssetId));
        const label = asset ? asset.FriendlyName : 'Egyéb';
        const isIncome = categories.find(c => c.Name === inv.Type)?.Type === 'income';
        const amount = parseFloat(inv.Amount || 0);

        if (key && key.length >= 4) {
          if (!dataMap[key]) dataMap[key] = { label: key };
          
          if (isIncome) {
            const incomeKey = `${label}_income`;
            dataMap[key][incomeKey] = (dataMap[key][incomeKey] || 0) + amount;
          } else {
            dataMap[key][label] = (dataMap[key][label] || 0) + amount;
          }
        }
      });
    }
    
    const sortedData = Object.values(dataMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
    
    if (chartRange === 'custom') {
      return sortedData.filter((item: any) => {
        const itemDate = item.label; 
        const start = viewMode === 'annual' ? customStartDate.substring(0, 4) : customStartDate;
        const end = viewMode === 'annual' ? customEndDate.substring(0, 4) : customEndDate;
        return itemDate >= (start || '0000') && itemDate <= (end || '9999');
      });
    }

    if (viewMode === 'monthly' && chartRange !== 'all') {
      return sortedData.slice(-chartRange as number);
    }
    
    return sortedData;
  }, [records, invoices, assets, filter, displayMode, viewMode, selectedAssetId, categories, chartRange, customStartDate, customEndDate]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const unit = displayMode === 'cost' ? 'Ft' : '';

      if (displayMode === 'usage') {
        const total = payload.reduce((sum: number, entry: any) => sum + (Number(entry.value) || 0), 0);
        return (
          <div style={{ backgroundColor: '#1e293b', padding: '12px', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', minWidth: '200px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ color: entry.color }}>{entry.name}:</span>
                <span style={{ fontWeight: 600 }}>{Number(entry.value).toLocaleString()} {unit}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.95rem', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155', fontWeight: 'bold', color: '#10b981' }}>
              <span>Összesen:</span><span>{total.toLocaleString()} {unit}</span>
            </div>
          </div>
        );
      }

      const expenses = payload.filter((p: any) => !p.dataKey.endsWith('_income'));
      const incomes = payload.filter((p: any) => p.dataKey.endsWith('_income'));
      
      const totalExp = expenses.reduce((sum: number, p: any) => sum + Number(p.value), 0);
      const totalInc = incomes.reduce((sum: number, p: any) => sum + Number(p.value), 0);
      const netTotal = totalInc - totalExp;

      return (
        <div style={{ backgroundColor: '#1e293b', padding: '12px', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', minWidth: '220px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{label}</p>
          
          {incomes.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#10b981', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Bevételek</div>
              {incomes.map((entry: any, index: number) => (
                <div key={`inc-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span style={{ color: entry.color }}>{entry.name.replace(' (Bevétel)', '')}:</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>+{Number(entry.value).toLocaleString()} {unit}</span>
                </div>
              ))}
            </div>
          )}

          {expenses.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ color: '#f87171', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Kiadások</div>
              {expenses.map((entry: any, index: number) => (
                <div key={`exp-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span style={{ color: entry.color }}>{entry.name}:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{Number(entry.value).toLocaleString()} {unit}</span>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #475569', fontSize: '0.85rem' }}>
            {totalExp > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}>
                <span>Össz. Kiadás:</span><span>-{totalExp.toLocaleString()} {unit}</span>
              </div>
            )}
            {totalInc > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                <span>Össz. Bevétel:</span><span>+{totalInc.toLocaleString()} {unit}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', marginTop: '4px', color: netTotal > 0 ? '#10b981' : (netTotal < 0 ? '#f87171' : '#f8fafc') }}>
              <span>Egyenleg:</span>
              <span>{netTotal > 0 ? '+' : ''}{netTotal.toLocaleString()} {unit}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- HANDLEREK ---

  const handleAssetSave = async () => {
    if (!newAsset.friendlyName) return alert("Adj nevet az eszköznek / személynek!");
    const method = editingAssetId ? 'PUT' : 'POST';
    const url = editingAssetId ? `${BACKEND_URL}/api/assets/${editingAssetId}` : `${BACKEND_URL}/api/assets`;
    
    try {
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
      } else {
        alert("Hiba történt.");
      }
    } catch (error) {
      alert("Hálózati hiba!");
    }
  };

  const handleCategorySave = async () => {
    if (!newCategory.name) return;
    const url = editingCategoryId ? `${BACKEND_URL}/api/categories/${editingCategoryId}` : `${BACKEND_URL}/api/categories`;
    const res = await fetch(url, {
      method: editingCategoryId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(newCategory)
    });
    if (res.ok) {
      setEditingCategoryId(null);
      setNewCategory({ name: '', icon: '📄', type: 'both', isPublic: false });
      fetchAll(user.token);
    } else {
      const data = await res.json();
      alert(data.error || "Hiba történt");
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!window.confirm("Biztosan törlöd a kategóriát? A hozzá tartozó adatoknál is gondot okozhat!")) return;
    const res = await fetch(`${BACKEND_URL}/api/categories/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }
    });
    if (res.ok) fetchAll(user.token);
    else {
      const data = await res.json();
      alert(data.error || "Hiba történt");
    }
  };

  const handleEditRecord = (item: any) => {
    setEditingRecordId(item.Id || item.id);
    setEditingRecordLType(item.lType);
    setRecordMode(item.lType);
    setTargetAssetId(String(item.AssetId));
    setType(item.Type);
    setValue(String(item.Value || item.Amount || ''));
    
    const dateStr = String(item.d).substring(0, 10);
    if (item.lType === 'meter') setMeterDate(dateStr);
    else setInvoiceDate(dateStr);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelRecordEdit = () => {
    setEditingRecordId(null);
    setEditingRecordLType(null);
    setValue('');
  };

  const handleSave = async () => {
    if (!targetAssetId || targetAssetId === 'all') return alert("Kérlek, válassz ki egy konkrét eszközt a mentéshez!");
    if (!value) return alert("Kérlek, add meg az értéket!");
    
    const currentCat = categories.find(c => c.Name === type);
    const isInvoiceType = currentCat?.Type === 'invoice_only' || currentCat?.Type === 'income';
    
    const body = { 
      type, 
      value: parseFloat(value), 
      amount: parseFloat(value), 
      date: (recordMode === 'invoice' || isInvoiceType) ? invoiceDate : meterDate, 
      assetId: parseInt(targetAssetId) 
    };

    const isEditing = editingRecordId !== null;
    const endpoint = isEditing 
        ? `/api/${editingRecordLType === 'meter' ? 'records' : 'invoices'}/${editingRecordId}`
        : ((recordMode === 'invoice' || isInvoiceType) ? '/api/invoices' : '/api/records');

    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify(body)
    });
    
    if (res.ok) { 
      setValue(''); 
      setEditingRecordId(null);
      setEditingRecordLType(null);
      fetchAll(user.token, viewingUserId!); 
    } 
    else { alert("Hiba történt a mentés/módosítás során."); }
  };

  const handleShare = async () => {
    if (!shareEmail) return alert("Kérlek adj meg egy email címet!");
    const res = await fetch(`${BACKEND_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ sharedWithEmail: shareEmail })
    });
    if (res.ok) { alert("Sikeres megosztás!"); setShareEmail(''); fetchMyShares(user.token); } 
    else { alert("Hiba történt a megosztás során."); }
  };

  const revokeShare = async (id: number) => {
    if (!window.confirm("Biztosan visszavonod a hozzáférést?")) return;
    const res = await fetch(`${BACKEND_URL}/api/shares/${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` }
    });
    if (res.ok) fetchMyShares(user.token);
  };

  const getIcon = (t: string) => {
    if (t === 'Összes') return '📊';
    if (t === 'Összes kiadás') return '📉';
    const cat = categories.find(c => c.Name === t);
    return cat ? cat.Icon : '📄';
  };

  const getColor = (t: string = filter) => {
    if (displayMode === 'cost' && t !== 'Összes' && t !== 'Összes kiadás') return '#10b981';
    if (t === 'Összes') return '#6366f1';
    if (t === 'Összes kiadás') return '#f43f5e';
    switch(t) {
      case 'Áram': return '#fbbf24';
      case 'Víz': return '#38bdf8';
      case 'Gáz': return '#f87171';
      case 'Üzemanyag': return '#a855f7';
      case 'Internet': return '#ec4899';
      case 'Szemétszállítás': return '#94a3b8';
      case 'Albérlet': return '#f472b6';
      default: 
        let hash = 0;
        for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
        return `hsl(${hash % 360}, 70%, 60%)`;
    }
  };

  const combinedList = [
    ...(filter === 'Összes' || filter === 'Összes kiadás' ? [] : records.filter(r => (selectedAssetId === 'all' || String(r.AssetId) === String(selectedAssetId)) && r.Type === filter).map(r => ({ ...r, lType: 'meter', d: r.FormattedDate }))),
    ...invoices.filter(i => {
      const isAssetMatch = selectedAssetId === 'all' || String(i.AssetId) === String(selectedAssetId);
      if (!isAssetMatch) return false;
      if (filter === 'Összes') return true;
      if (filter === 'Összes kiadás') return categories.find(c => c.Name === i.Type)?.Type !== 'income';
      return i.Type === filter;
    }).map(i => ({ ...i, lType: 'invoice', Value: i.Amount, d: i.Month }))
  ].sort((a, b) => new Date(b.d).getTime() - new Date(a.d).getTime());

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-wrapper">
        <header className="main-header">
          <h1 className="logo">Rezsiapp 2.0</h1>
          {user && (
            <div className="user-info">
              {!isReadOnly && (
                <button className="btn-asset-toggle" onClick={() => { setShowCategoryManager(!showCategoryManager); setShowAssetManager(false); }}>⚙️ Kategóriák</button>
              )}
              {!isReadOnly && (
                <button className="btn-asset-toggle" onClick={() => { setShowAssetManager(!showAssetManager); setShowCategoryManager(false); }}>🏠 Eszközök</button>
              )}
              <img src={user.picture} alt="Profil" title={user.email} />
              <button className="btn-logout" onClick={forceLogout}>Kilépés</button>
            </div>
          )}
        </header>

        {showCategoryManager && !isReadOnly && (
          <section className="card asset-manager-card">
            <h3>Kategóriák karbantartása</h3>
            <div className="asset-form">
              <input placeholder="Ikon (pl. ⚡)" value={newCategory.icon} onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})} style={{width: '60px'}}/>
              <input placeholder="Kategória neve" value={newCategory.name} onChange={(e) => setNewCategory({...newCategory, name: e.target.value})} />
              <select value={newCategory.type} onChange={(e) => setNewCategory({...newCategory, type: e.target.value})}>
                <option value="both">📟 Óraállás + 💰 Számla (Kiadás)</option>
                <option value="invoice_only">Csak 💰 Számla (Kiadás)</option>
                <option value="income">💵 Bevétel (Csak Számla)</option>
              </select>
              
              {isAdmin && (
                <label style={{color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <input type="checkbox" checked={newCategory.isPublic} onChange={(e) => setNewCategory({...newCategory, isPublic: e.target.checked})} />
                  Publikus (Mindenki látja)
                </label>
              )}

              <div className="asset-form-buttons">
                <button className="btn-primary" onClick={handleCategorySave}>Mentés</button>
                {editingCategoryId && <button className="btn-secondary" onClick={() => { setEditingCategoryId(null); setNewCategory({ name: '', icon: '📄', type: 'both', isPublic: false }); }}>Mégse</button>}
              </div>
            </div>
            
            <div className="asset-list">
              {categories.map((c: any) => {
                const isPublicCat = c.UserId === null;
                const canEdit = !isPublicCat || isAdmin;

                return (
                  <div key={c.Id} className="asset-item">
                    <div className="asset-item-info">
                      <span>{c.Icon} {c.Name} {isPublicCat ? '🌐' : '🔒'}</span> 
                      <small>
                        ({c.Type === 'both' ? 'Mindkettő' : c.Type === 'income' ? 'Bevétel' : 'Csak számla'})
                        {!isPublicCat && <span style={{color: '#fbbf24', marginLeft: '5px'}}>• Privát</span>}
                      </small>
                    </div>
                    {canEdit && (
                      <div>
                        <button className="btn-edit-small" onClick={() => { 
                          setEditingCategoryId(c.Id); 
                          setNewCategory({ name: c.Name, icon: c.Icon, type: c.Type, isPublic: isPublicCat }); 
                        }}>✏️</button>
                        <button className="btn-edit-small" onClick={() => handleCategoryDelete(c.Id)}>❌</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {showAssetManager && user && !isReadOnly && (
          <section className="card asset-manager-card">
            <h3>{editingAssetId ? "Módosítás" : "Új eszköz / Személy"}</h3>
            <div className="asset-form">
              <select value={newAsset.category} onChange={(e) => setNewAsset({...newAsset, category: e.target.value})}>
                <option value="property">🏠 Ingatlan</option>
                <option value="car">🚗 Jármű</option>
                <option value="person">👤 Személy (Saját/Családtag)</option>
              </select>
              <input placeholder="Név" value={newAsset.friendlyName} onChange={(e) => setNewAsset({...newAsset, friendlyName: e.target.value})} />
              
              {newAsset.category === 'property' && (
                <>
                  <input placeholder="Város" value={newAsset.city} onChange={(e) => setNewAsset({...newAsset, city: e.target.value})} />
                  <input placeholder="Utca, házszám" value={newAsset.street} onChange={(e) => setNewAsset({...newAsset, street: e.target.value})} />
                  <input placeholder="m²" type="number" value={newAsset.area} onChange={(e) => setNewAsset({...newAsset, area: e.target.value})} />
                </>
              )}
              {newAsset.category === 'car' && (
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
                  <div className="asset-item-info">
                    <span>{a.Category === 'car' ? '🚗' : a.Category === 'person' ? '👤' : '🏠'} {a.FriendlyName}</span>
                    <small>{a.Category === 'car' ? a.PlateNumber : a.Category === 'property' ? a.City : 'Személyes'}</small>
                  </div>
                  <button className="btn-edit-small" onClick={() => { 
                    setEditingAssetId(a.Id);
                    setNewAsset({ 
                      category: a.Category || 'property', friendlyName: a.FriendlyName || '', city: a.City || '', street: a.Street || '',
                      houseNumber: a.HouseNumber || '', plateNumber: a.PlateNumber || '', fuelType: a.FuelType || 'Benzin', area: a.Area || ''
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
                  {assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.Category === 'car' ? '🚗' : a.Category === 'person' ? '👤' : '🏠'} {a.FriendlyName}</option>))}
                </select>
                
                  {!isReadOnly && (
                  <>
                    <div className="share-input-group">
                      <input type="email" placeholder="Kivel osztod meg?" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                      <button className="btn-share" onClick={handleShare}>+</button>
                    </div>
                    
                    {myShares.length > 0 && (
                      <div className="shared-list" style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px' }}>Hozzáféréssel rendelkeznek:</p>
                        {myShares.map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', fontSize: '0.85rem' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.shared_with_email}</span>
                            <button onClick={() => revokeShare(s.id)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}>Visszavonás</button>
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
                {editingRecordId && <div style={{color: '#fbbf24', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '10px'}}>✏️ Adat szerkesztése folyamatban...</div>}
                
                <div className="record-type-toggle">
                  <button className={recordMode === 'meter' ? 'active' : ''} onClick={() => setRecordMode('meter')} disabled={editingRecordId !== null || assets.find(a => String(a.Id) === String(targetAssetId))?.Category === 'car' || categories.find(c => c.Name === type)?.Type === 'invoice_only' || categories.find(c => c.Name === type)?.Type === 'income'}>📟 Óraállás</button>
                  <button className={recordMode === 'invoice' ? 'active' : ''} onClick={() => setRecordMode('invoice')} disabled={editingRecordId !== null}>💰 Számla / Bevétel</button>
                </div>
                <div className="input-row">
                  <select value={targetAssetId} onChange={(e) => setTargetAssetId(e.target.value)}><option value="">Eszköz / Személy...</option>{assets.map((a: any) => (<option key={a.Id} value={a.Id}>{a.FriendlyName}</option>))}</select>
                  <select value={type} onChange={(e) => setType(e.target.value)}>{getAllowedTypes(targetAssetId).map(t => <option key={t} value={t}>{getIcon(t)} {t}</option>)}</select>
                  <input type="date" value={recordMode === 'meter' ? meterDate : invoiceDate} onChange={(e) => recordMode === 'meter' ? setMeterDate(e.target.value) : setInvoiceDate(e.target.value)} />
                  <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Érték / Ft" />
                </div>
                
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="btn-primary" onClick={handleSave} disabled={!targetAssetId || targetAssetId === 'all' || !value} style={{ flex: 1 }}>
                    {editingRecordId ? 'Adat módosítása' : 'Adat mentése'}
                  </button>
                  {editingRecordId && (
                    <button className="btn-secondary" onClick={cancelRecordEdit} style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1' }}>Mégse</button>
                  )}
                </div>
              </section>
            )}

            <div className="controls-bar">
              <div className="filter-buttons">
                {categories.map(c => (
                  <button key={c.Id} className={filter === c.Name ? 'active' : ''} onClick={() => setFilter(c.Name)} style={filter === c.Name ? {backgroundColor: getColor(c.Name), borderColor: getColor(c.Name)} : {}}>{c.Icon} {c.Name}</button>
                ))}
                {displayMode === 'cost' && (
                  <>
                    <button className={filter === 'Összes kiadás' ? 'active' : ''} onClick={() => setFilter('Összes kiadás')} style={{backgroundColor: filter === 'Összes kiadás' ? getColor('Összes kiadás') : ''}}>{getIcon('Összes kiadás')} Összes kiadás</button>
                    <button className={filter === 'Összes' ? 'active' : ''} onClick={() => setFilter('Összes')} style={{backgroundColor: filter === 'Összes' ? getColor('Összes') : ''}}>{getIcon('Összes')} Összes (+Bevétel)</button>
                  </>
                )}
              </div>
              <div className="mode-toggle">
                <button className={displayMode === 'usage' ? 'active' : ''} disabled={categories.find(c => c.Name === filter)?.Type === 'invoice_only' || categories.find(c => c.Name === filter)?.Type === 'income' || filter === 'Összes' || filter === 'Összes kiadás'} onClick={() => setDisplayMode('usage')}>Fogyasztás</button>
                <button className={displayMode === 'cost' ? 'active' : ''} onClick={() => setDisplayMode('cost')}>Költség</button>
              </div>
              
              <div className="view-toggle" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>Havi</button>
                <button className={viewMode === 'annual' ? 'active' : ''} onClick={() => setViewMode('annual')}>Éves</button>
                
                <select 
                  value={chartRange} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setChartRange(val === 'all' || val === 'custom' ? val : parseInt(val));
                  }}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '20px', 
                    background: '#1e293b', 
                    color: '#94a3b8', 
                    border: '1px solid #334155',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {viewMode === 'monthly' && <option value={6}>Utolsó 6 hónap</option>}
                  {viewMode === 'monthly' && <option value={12}>Utolsó 12 hónap</option>}
                  {viewMode === 'monthly' && <option value={24}>Utolsó 24 hónap</option>}
                  <option value="all">Összes mutatása</option>
                  <option value="custom">Egyedi tartomány...</option>
                </select>

                {chartRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                      type="month" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)} 
                      style={{ padding: '4px 8px', borderRadius: '15px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', outline: 'none', colorScheme: 'dark' }}
                    />
                    <span style={{color: '#94a3b8'}}>-</span>
                    <input 
                      type="month" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)} 
                      style={{ padding: '4px 8px', borderRadius: '15px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', outline: 'none', colorScheme: 'dark' }}
                    />
                  </div>
                )}
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
                      
                      {(selectedAssetId === 'all' ? assets : assets.filter(a => String(a.Id) === String(selectedAssetId))).map((asset, idx) => {
                        const color = selectedAssetId === 'all' ? ASSET_COLORS[idx % ASSET_COLORS.length] : getColor();
                        return (
                          <React.Fragment key={asset.Id}>
                            <Bar dataKey={asset.FriendlyName} stackId="expense" fill={color} />
                            <Bar 
                              dataKey={`${asset.FriendlyName}_income`} 
                              name={`${asset.FriendlyName} (Bevétel)`} 
                              stackId="income" 
                              fill={color} 
                              opacity={0.6} 
                              legendType="none" 
                            />
                          </React.Fragment>
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="no-data-msg">Nincs adat a kiválasztott időszakban</div>}
              </div>
            </section>

            <section className="list-section">
              <div className="list-container">
                {combinedList.map((item: any, idx) => {
                  const asset = assets.find(a => String(a.Id) === String(item.AssetId));
                  const cat = categories.find(c => c.Name === item.Type);
                  const isIncome = cat?.Type === 'income';

                  return (
                    <div key={idx} className={`record-item ${item.Type}`}>
                      <div className="record-info">
                        <div className="record-main-line"><span>{item.lType === 'meter' ? '📟' : '💰'} {String(item.d).substring(0, 10)} ({getIcon(item.Type)} {item.Type})</span></div>
                        <div className="asset-tag">{asset ? <>{asset.Category === 'car' ? '🚗' : asset.Category === 'person' ? '👤' : '🏠'} {asset.FriendlyName}</> : 'Nincs eszköz'}</div>
                      </div>
                      <div className="record-value-container">
                        <span className="record-value" style={{ color: isIncome ? '#10b981' : '' }}>
                          {isIncome ? '+' : ''}{(parseFloat(item.Value) || 0).toLocaleString()} {item.lType === 'meter' ? 'egység' : 'Ft'}
                        </span>
                        {!isReadOnly && (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className="btn-edit" onClick={() => handleEditRecord(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✏️</button>
                            <button className="btn-delete" onClick={async () => { if(window.confirm("Törlöd?")) { await fetch(`${BACKEND_URL}/api/${item.lType === 'meter' ? 'records' : 'invoices'}/${item.Id || item.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user.token}` } }); fetchAll(user.token); } }}>❌</button>
                          </div>
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
