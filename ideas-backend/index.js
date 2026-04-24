// ideas-backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

// A TE FIX CLIENT ID-D
const GOOGLE_CLIENT_ID = "197361744572-ih728hq5jft3fqfd1esvktvrd8i97kcp.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// MIDDLEWARE - Token ellenőrzés
async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Nincs token!');
  
  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.userId = payload.sub; // Google egyedi azonosító
    next();
  } catch (err) {
    console.error("Token hiba:", err.message);
    res.status(401).send('Érvénytelen munkamenet');
  }
}

// --- ÚTVONALAK ---

// 1. LEKÉRDEZÉS (Csak a saját adatok)
app.get('/api/records', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT Id, Type, Value, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Adatbázis hiba' });
  }
});

// 2. MENTÉS
app.post('/api/records', verifyUser, async (req, res) => {
  const { type, value, date } = req.body;
  try {
    await pool.query(
      'INSERT INTO utility_records (Type, Value, Date, UserId) VALUES (?, ?, ?, ?)',
      [type, value, date, req.userId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mentési hiba történt' });
  }
});

// 3. TÖRLÉS
app.delete('/api/records/:id', verifyUser, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM utility_records WHERE Id = ? AND UserId = ?', 
      [id, req.userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Nincs ilyen rekord vagy nincs hozzáférésed' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Törlési hiba' });
  }
});
// index.js módosítások

// 1. A verifyUser-t egészítsd ki, hogy az emailt is elmentse
async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Nincs token!');
  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.userId = payload.sub;
    req.userEmail = payload.email; // EZ ÚJ: Elmentjük az emailt is
    next();
  } catch (err) {
    res.status(401).send('Érvénytelen munkamenet');
  }
}

// 2. ÚJ ÚTVONAL: Megosztás létrehozása
app.post('/api/shares', verifyUser, async (req, res) => {
  const { sharedWithEmail } = req.body;
  try {
    await pool.query(
      'INSERT INTO shares (owner_id, owner_email, shared_with_email) VALUES (?, ?, ?)',
      [req.userId, req.userEmail, sharedWithEmail]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hiba a megosztáskor' });
  }
});

// 3. ÚJ ÚTVONAL: Kik osztották meg velem az adataikat?
app.get('/api/shares/me', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT owner_id, owner_email FROM shares WHERE shared_with_email = ?',
      [req.userEmail]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Hiba a lekérdezéskor' });
  }
});

// 4. MÓDOSÍTOTT LEKÉRDEZÉS: Saját VAGY megosztott adatok látása
app.get('/api/records', verifyUser, async (req, res) => {
  const targetUserId = req.query.userId || req.userId; // Ha van userId a paraméterben, azt nézzük
  
  try {
    // Ellenőrizzük, hogy van-e jogunk látni (vagy saját, vagy megosztották velünk)
    const [hasAccess] = await pool.query(
      'SELECT id FROM shares WHERE owner_id = ? AND shared_with_email = ?',
      [targetUserId, req.userEmail]
    );

    if (targetUserId !== req.userId && hasAccess.length === 0) {
      return res.status(403).json({ error: 'Nincs jogosultságod ezekhez az adatokhoz' });
    }

    const [rows] = await pool.query(
      'SELECT Id, Type, Value, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
      [targetUserId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Adatbázis hiba' });
  }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API fut a ${PORT} porton`));
