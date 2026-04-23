// index.js módosított részei

// Lekérdezés (GET): Minden mezőt lekérünk, a dátumot szebben formázva
app.get('/api/records', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, type, value, DATE_FORMAT(date, "%Y-%m-%d %H:%i") as formatted_date FROM utility_records ORDER BY date DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Adatbázis hiba történt.' });
  }
});

// Új adat felvitele (POST): type és value érkezik a frontenden keresztül
app.post('/api/records', async (req, res) => {
  const { type, value } = req.body;

  if (!type || !value) {
    return res.status(400).json({ error: 'Típus és érték megadása kötelező!' });
  }

  try {
    // A NOW() függvény automatikusan beilleszti az aktuális időpontot
    const [result] = await pool.query(
      'INSERT INTO utility_records (type, value, date) VALUES (?, ?, NOW())',
      [type, value]
    );
    res.status(201).json({ id: result.insertId, type, value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nem sikerült a mentés.' });
  }
});
