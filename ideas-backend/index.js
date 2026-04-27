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

// --- AUTENTIKÁCIÓS MIDDLEWARE (Cron-job barát verzió) ---
async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization;
  const cronKey = req.headers['x-cron-key'];
  
  // 1. Megnézzük, hogy a Cron-job küldte-e a titkos kulcsot
  // Javaslat: A kódban lévő értéket cseréld le process.env.CRON_SECRET-re a Render-en!
  const SAFE_CRON_KEY = process.env.CRON_SECRET || "SzuperTitkosCronKulcs123_2026";
  
  if (cronKey && cronKey === SAFE_CRON_KEY) {
    req.userId = "CRON_ADMIN"; // Fiktív ID a rendszernek
    req.userEmail = "cron@rezsiapp.system";
    return next();
  }

  // 2. Ha nem cron-job, akkor Google Auth ellenőrzés
  if (!authHeader) return res.status(401).send('Nincs token!');
  
  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    res.status(401).send('Érvénytelen munkamenet');
  }
}

// --- PUBLIKUS ÚTVONAL ÉBRESZTÉSHEZ ---
app.get('/ping', (req, res) => {
  res.send('Szerver ébren van! 🚀');
});

// --- SZÁMLÁK KEZELÉSE ---

app.get('/api/invoices', verifyUser, async (req, res) => {
  const targetUserId = req.query.userId || req.userId;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM invoices WHERE UserId = ? ORDER BY Month DESC',
      [targetUserId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Hiba a számlák lekérésekor' });
  }
});

app.delete('/api/invoices/:id', verifyUser, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM invoices WHERE Id = ? AND UserId = ?',
      [id, req.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Számla nem található vagy nincs jogosultság' });
    }
    res.json({ success: true, message: 'Számla sikeresen törölve' });
  } catch (err) {
    res.status(500).json({ error: 'Hiba történt a törlés során' });
  }
});

// index.js - Számla mentése (Most már minden tétel új sor!)
app.post('/api/invoices', verifyUser, async (req, res) => {
  const { type, amount, date } = req.body; // Most már 'date'-et várunk 'month' helyett
  try {
    await pool.query(
      'INSERT INTO invoices (Type, Amount, Month, UserId) VALUES (?, ?, ?, ?)',
      [type, amount, date, req.userId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hiba a számla mentésekor' });
  }
});

// --- MÉRŐÓRA REKORDOK KEZELÉSE ---

// index.js - Mérőóra rekordok lekérése
app.get('/api/records', verifyUser, async (req, res) => {
  const targetUserId = req.query.userId || req.userId;
  
  try {
    // ... (jogosultság ellenőrző rész marad)

    const [rows] = await pool.query(
      // HOZZÁADVA: AssetId
      'SELECT Id, Type, Value, AssetId, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
      [targetUserId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB hiba' });
  }
});

app.post('/api/records', verifyUser, async (req, res) => {
  const { type, value, date } = req.body;
  try {
    await pool.query(
      'INSERT INTO utility_records (Type, Value, Date, UserId) VALUES (?, ?, ?, ?)',
      [type, value, date, req.userId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hiba mentéskor' });
  }
});

app.delete('/api/records/:id', verifyUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM utility_records WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Hiba törléskor' });
  }
});

// --- MEGOSZTÁSOK ---

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

// Belépés naplózása
app.post('/api/login-sync', verifyUser, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO users (google_id, email, last_login) 
       VALUES (?, ?, NOW()) 
       ON DUPLICATE KEY UPDATE last_login = NOW(), email = VALUES(email)`,
      [req.userId, req.userEmail]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Login log hiba:", err);
    res.status(500).json({ error: 'Nem sikerült naplózni a belépést' });
  }
});

// --- ESZKÖZÖK (ASSETS) KEZELÉSE ---

// Eszközök lekérése
app.get('/api/assets', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM assets WHERE UserId = ?', [req.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Hiba az eszközök lekérésekor' });
  }
});

// Új eszköz hozzáadása
app.post('/api/assets', verifyUser, async (req, res) => {
  const { category, friendlyName, city, street, houseNumber, plateNumber, fuelType, area } = req.body;
  
  // Debug log: látni fogod a konzolon, mi érkezik
  console.log("Mentés próbája:", req.body);

  try {
    const [result] = await pool.query(
      `INSERT INTO assets (UserId, Category, FriendlyName, City, Street, HouseNumber, PlateNumber, FuelType, Area) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, category, friendlyName, city, street, houseNumber, plateNumber, fuelType, area || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("SQL HIBA AZ ESZKÖZMENTÉSNÉL:", err); // Ez kiírja a pontos hibát a Render logba!
    res.status(500).json({ error: 'Hiba az adatbázis mentésnél', details: err.message });
  }
});

// Eszköz törlése
app.delete('/api/assets/:id', verifyUser, async (req, res) => {
  try {
    await pool.query('DELETE FROM assets WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Hiba a törléskor' });
  }
});

// MÓDOSÍTOTT MENTÉSEK (AssetId támogatása)
app.post('/api/records', verifyUser, async (req, res) => {
  const { type, value, date, assetId } = req.body;
  try {
    await pool.query(
      'INSERT INTO utility_records (Type, Value, Date, UserId, AssetId) VALUES (?, ?, ?, ?, ?)',
      [type, value, date, req.userId, assetId || null]
    );
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.post('/api/invoices', verifyUser, async (req, res) => {
  const { type, amount, date, assetId } = req.body;
  try {
    await pool.query(
      'INSERT INTO invoices (Type, Amount, Month, UserId, AssetId) VALUES (?, ?, ?, ?, ?)',
      [type, amount, date, req.userId, assetId || null]
    );
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

// Eszköz adatainak módosítása
app.put('/api/assets/:id', verifyUser, async (req, res) => {
  const { friendlyName, category, city, street, plateNumber, area } = req.body;
  try {
    await pool.query(
      `UPDATE assets 
       SET FriendlyName = ?, Category = ?, City = ?, Street = ?, PlateNumber = ?, Area = ? 
       WHERE Id = ? AND UserId = ?`,
      [friendlyName, category, city || null, street || null, plateNumber || null, area || null, req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nem sikerült a módosítás' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Szerver fut: ${PORT}`));
