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
  const [records, setRecords] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  
  const [type, setType] = useState('Áram');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('Áram');
  const [viewMode, setViewMode] = useState('daily');

  const fetchRecords = async (token: string, targetId?: string) => {
    const idToFetch = targetId || viewingUserId || user?.sub;
    if (!idToFetch) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/records?userId=${idToFetch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setRecords(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchShares = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSharedWithMe(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
      try {
        const decoded: any = jwtDecode(savedToken);
        setUser({ ...decoded, token: savedToken });
        setViewingUserId(decoded.sub);
        fetchRecords(savedToken, decoded.sub);
        fetchShares(savedToken);
      } catch (e) { localStorage.removeItem('userToken'); }
    }
  }, []);

  const handleLoginSuccess = (credentialResponse: any) => {
    const token = credentialResponse.credential;
    const decoded: any = jwtDecode(token);
    setUser({ ...decoded, token: token });
    setViewingUserId(decoded.sub);
    localStorage.setItem('userToken', token);
    fetchRecords(token, decoded.sub);
    fetchShares(token);
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setRecords([]);
    localStorage.removeItem('userToken');
  };

  const handleShare = async () => {
    if (!shareEmail || !user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ sharedWithEmail: shareEmail.toLowerCase() })
      });
      if (res.ok) { alert("Sikeres megosztás!"); setShareEmail(''); }
    } catch (err) { alert("Hiba"); }
  };

  const handleUserChange = (newId: string) => {
    setViewingUserId(newId);
    fetchRecords(user.token, newId);
  };

  const handleSave = async () => {
    if (!value || !date || !user) return alert("Minden mezőt tölts ki!");
    try {
      await fetch(`${BACKEND_URL}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ type, value: parseFloat(value), date })
      });
      setValue('');
      fetchRecords(user.token);
    } catch (err) { alert("Hiba"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Biztosan törlöd?") || !user) return;
    try {
      await fetch(`${BACKEND_URL}/api/records/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      fetchRecords(user.token);
    } catch (err) { alert("Hiba"); }
  };

  const currentTypeRecords = records.filter((r: any) => r.Type === filter)
    .sort((a: any, b: any) => new Date(a.FormattedDate).getTime() - new Date(b.FormattedDate).getTime());

  const dailyData = currentTypeRecords.map((r: any) => ({ label: r.FormattedDate.split(' ')[0], ertek: parseFloat(r.Value) }));

  const getMonthlyConsumption = () => {
    const monthlySum: { [key: string]: number } = {};
    if (filter === 'Üzemanyag') {
      currentTypeRecords.forEach((r: any) => {
        const monthKey = r.FormattedDate.substring(0, 7);
        monthlySum[monthKey] = (monthlySum[monthKey] || 0) + parseFloat(r.Value);
      });
    } else {
      for (let i = 1; i < currentTypeRecords.length; i++) {
        const curV = parseFloat(currentTypeRecords[i].Value);
        const preV = parseFloat(currentTypeRecords[i-1].Value);
        if (curV >= preV) {
          const mKey = currentTypeRecords[i].FormattedDate.substring(0, 7);
          monthlySum[mKey] = (monthlySum[mKey] || 0) + (curV - preV);
        }
      }
    }
    return Object.keys(monthlySum).sort().map(m => ({ label: m, ertek: Math.round(monthlySum[m] * 100) / 100 }));
  };

  const getAnnualConsumption = () => {
    const annualSum: { [key: string]: number } = {};
    if (filter === 'Üzemanyag') {
      currentTypeRecords.forEach((r: any) => {
        const yearKey = r.FormattedDate.substring(0, 4);
        annualSum[yearKey] = (annualSum[yearKey] || 0) + parseFloat(r.Value);
      });
    } else {
      for (let i = 1; i < currentTypeRecords.length; i++) {
        const curV = parseFloat(currentTypeRecords[i].Value);
        const preV = parseFloat(currentTypeRecords[i-1].Value);
        if (curV >= preV) {
          const yKey = currentTypeRecords[i].FormattedDate.substring(0, 4);
          annualSum[yKey] = (annualSum[yKey] || 0) + (curV - preV);
        }
      }
    }
    return Object.keys(annualSum).sort
