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

// Teszt útvonal
app.get('/', async (req, res) => {
  res.json({ status: 'Backend működik 🎉' });
});

// Ötlet lekérdezés
app.get('/api/ideas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title FROM photo_ideas ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Új ötlet felvitel
app.post('/api/ideas', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title required' });
  }
  try {
    const [result] = await pool.query('INSERT INTO photo_ideas (title) VALUES (?)', [title.trim()]);
    res.status(201).json({ id: result.insertId, title: title.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Törlés
app.delete('/api/ideas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM photo_ideas WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ API fut a http://localhost:${PORT}`);
});
