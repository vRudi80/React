require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_CLIENT_ID = "197361744572-ih728hq5jft3fqfd1esvktvrd8i97kcp.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// TOKEN ELLENŐRZÉS + EMAIL CÍM KINYERÉSE
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
    req.userEmail = payload.email; // Fontos a megosztáshoz!
    next();
  } catch (err) {
    res.status(401).send('Érvénytelen munkamenet');
  }
}

// 1. LEKÉRDEZÉS (Saját VAGY Megosztott)
app.get('/api/records', verifyUser, async (req, res) => {
  const targetUserId = req.query.userId || req.userId;
  
  try {
    // Ha nem a sajátját kéri, ellenőrizzük a megosztást
    if (targetUserId !== req.userId) {
      const [shares] = await pool.query(
        'SELECT id FROM shares WHERE owner_id = ? AND shared_with_email = ?',
        [targetUserId, req.userEmail]
      );
      
      if (shares.length === 0) {
        console.log(`Hozzáférés megtagadva: ${req.userEmail} -> ${targetUserId}`);
        return res.status(403).json({ error: 'Nincs jogosultságod' });
      }
    }

    const [rows] = await pool.query(
      'SELECT Id, Type, Value, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
      [targetUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB hiba' });
  }
});

// 2. MENTÉS (Mindig a saját UserId-hoz)
app.post('/api/records', verifyUser, async (req, res) => {
  const { type, value, date } = req.body;
  try {
    await pool.query(
      'INSERT INTO utility_records (Type, Value, Date, UserId) VALUES (?, ?, ?, ?)',
      [type, value, date, req.userId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hiba' });
  }
});

// 3. MEGOSZTÁS LÉTREHOZÁSA
app.post('/api/shares', verifyUser, async (req, res) => {
  const { sharedWithEmail } = req.body;
  try {
    await pool.query(
      'INSERT INTO shares (owner_id, owner_email, shared_with_email) VALUES (?, ?, ?)',
      [req.userId, req.userEmail, sharedWithEmail]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Megosztási hiba' });
  }
});

// 4. KIK OSZTOTTÁK MEG VELEM
app.get('/api/shares/me', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT owner_id, owner_email FROM shares WHERE shared_with_email = ?',
      [req.userEmail]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Hiba' });
  }
});

// 5. TÖRLÉS
app.delete('/api/records/:id', verifyUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM utility_records WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Hiba' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Szerver fut: ${PORT}`));
