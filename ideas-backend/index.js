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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API fut a ${PORT} porton`));
