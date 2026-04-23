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

// Adatok lekérése
app.get('/api/records', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT Id, Type, Value, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records ORDER BY Date DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Adatbázis hiba' });
  }
});

// index.js - Új adat mentése választható dátummal
app.post('/api/records', async (req, res) => {
  const { type, value, date } = req.body; // Most már a 'date' is megérkezik
  try {
    const [result] = await pool.query(
      'INSERT INTO utility_records (Type, Value, Date) VALUES (?, ?, ?)',
      [type, value, date] // A kiválasztott dátumot szúrjuk be
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mentési hiba' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
