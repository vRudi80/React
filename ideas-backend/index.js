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

// Adatok lekérése (Figyelve a nagybetűs oszlopokra!)
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

// Mentés
app.post('/api/records', async (req, res) => {
  const { type, value } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO utility_records (Type, Value, Date) VALUES (?, ?, NOW())',
      [type, value]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mentési hiba' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API fut a ${PORT} porton`));
