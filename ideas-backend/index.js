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

// --- AUTENTIKÁCIÓS MIDDLEWARE ---
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
        req.userEmail = payload.email;
        next();
    } catch (err) {
        res.status(401).send('Érvénytelen munkamenet');
    }
}

// SEGÉDFÜGGVÉNY: Ellenőrzi, hogy a bejelentkezett user láthatja-e a célszemély adatait
async function canAccessData(requesterId, requesterEmail, targetUserId) {
    if (requesterId === targetUserId) return true;
    const [rows] = await pool.query(
        'SELECT id FROM shares WHERE owner_id = ? AND shared_with_email = ?',
        [targetUserId, requesterEmail]
    );
    return rows.length > 0;
}

// --- API ÚTVONALAK ---

// Adatok lekérése (Mérőóra)
app.get('/api/records', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    const hasPermission = await canAccessData(req.userId, req.userEmail, targetUserId);
    
    if (!hasPermission) return res.status(403).json({ error: "Nincs jogosultság" });

    try {
        const [rows] = await pool.query(
            'SELECT Id, Type, Value, AssetId, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC',
            [targetUserId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

// Adatok lekérése (Számlák)
app.get('/api/invoices', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    const hasPermission = await canAccessData(req.userId, req.userEmail, targetUserId);
    
    if (!hasPermission) return res.status(403).json({ error: "Nincs jogosultság" });

    try {
        const [rows] = await pool.query(
            'SELECT * FROM invoices WHERE UserId = ? ORDER BY Month DESC',
            [targetUserId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

// Eszközök lekérése
app.get('/api/assets', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    const hasPermission = await canAccessData(req.userId, req.userEmail, targetUserId);
    
    if (!hasPermission) return res.status(403).json({ error: "Nincs jogosultság" });

    try {
        const [rows] = await pool.query('SELECT * FROM assets WHERE UserId = ?', [targetUserId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

// Megosztások kezelése
app.post('/api/shares', verifyUser, async (req, res) => {
    const { sharedWithEmail } = req.body;
    try {
        await pool.query(
            'INSERT INTO shares (owner_id, owner_email, shared_with_email) VALUES (?, ?, ?)',
            [req.userId, req.userEmail, sharedWithEmail]
        );
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Megosztási hiba' }); }
});

// Kik osztották meg velem?
app.get('/api/shares/me', verifyUser, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT DISTINCT owner_id, owner_email FROM shares WHERE shared_with_email = ?',
            [req.userEmail]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

// ÍRÁSI MŰVELETEK (Csak a tulajdonosnak!)
// index.js fontos része:
app.post('/api/records', verifyUser, async (req, res) => {
    const { type, value, date, assetId } = req.body;
    // Szigorúan a bejelentkezett user ID-ját használjuk!
    try {
        await pool.query(
            'INSERT INTO utility_records (Type, Value, Date, UserId, AssetId) VALUES (?, ?, ?, ?, ?)',
            [type, value, date, req.userId, assetId]
        );
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).send(err); }
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

app.delete('/api/records/:id', verifyUser, async (req, res) => {
    await pool.query('DELETE FROM utility_records WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Szerver fut: ${PORT}`));
