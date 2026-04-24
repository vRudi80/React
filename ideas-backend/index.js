require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// LEKÉRDEZÉS
app.get('/api/records', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT Id, Type, Value, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records ORDER BY Date DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB hiba' });
  }
});

// MENTÉS
app.post('/api/records', async (req, res) => {
  const { type, value, date } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO utility_records (Type, Value, Date) VALUES (?, ?, ?)',
      [type, value, date]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mentési hiba' });
  }
});

// --- EZ HIÁNYZOTT: TÖRLÉS ---
app.delete('/api/records/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Fontos: Nagy 'Id' kell, mert az adatbázisodban így szerepel!
    const [result] = await pool.query('DELETE FROM utility_records WHERE Id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Nincs ilyen rekord' });
    }
    
    res.status(204).end();
  } catch (err) {
    console.error("Törlési hiba:", err);
    res.status(500).json({ error: 'Szerver hiba törléskor' });
  }
});
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('A_TE_CLIENT_ID_D');

// Middleware a felhasználó azonosítására
async function verifyUser(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Be kell jelentkezned!');
  
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: 'A_TE_CLIENT_ID_D',
    });
    const payload = ticket.getPayload();
    req.userId = payload.sub; // Ez a felhasználó egyedi Google azonosítója
    next();
  } catch (err) {
    res.status(401).send('Érvénytelen munkamenet');
  }
}

// Lekérdezésnél csak a saját adatait kapja meg:
app.get('/api/records', verifyUser, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
    [req.userId]
  );
  res.json(rows);
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API fut a ${PORT} porton`));
