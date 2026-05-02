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

// ⚠️ IDE ÍRD BE A SAJÁT E-MAIL CÍMEDET, AKIVEL BEJELENTKEZEL!
const ADMIN_EMAILS = ['kovari.rudolf@gmail.com']; 

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// --- AUTENTIKÁCIÓ ÉS JOGOSULTSÁGOK ---
async function verifyUser(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('Nincs token!');
    
    const token = authHeader.split(' ')[1];
    try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        req.userId = payload.sub;
        req.userEmail = payload.email;
        next();
    } catch (err) { res.status(401).send('Érvénytelen munkamenet'); }
}

function requireAdmin(req, res, next) {
    if (!ADMIN_EMAILS.includes(req.userEmail)) {
        return res.status(403).json({ error: 'Nincs adminisztrátori jogosultságod!' });
    }
    next();
}

async function canAccessData(requesterId, requesterEmail, targetUserId) {
    if (requesterId === targetUserId) return true;
    const [rows] = await pool.query('SELECT id FROM shares WHERE owner_id = ? AND shared_with_email = ?', [targetUserId, requesterEmail]);
    return rows.length > 0;
}

// --- KATEGÓRIÁK KEZELÉSE (ÚJ) ---
app.get('/api/categories', verifyUser, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY Id ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

app.post('/api/categories', verifyUser, requireAdmin, async (req, res) => {
    const { name, icon, type } = req.body;
    try {
        await pool.query('INSERT INTO categories (Name, Icon, Type) VALUES (?, ?, ?)', [name, icon, type]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.put('/api/categories/:id', verifyUser, requireAdmin, async (req, res) => {
    const { name, icon, type } = req.body;
    try {
        await pool.query('UPDATE categories SET Name = ?, Icon = ?, Type = ? WHERE Id = ?', [name, icon, type, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.delete('/api/categories/:id', verifyUser, requireAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE Id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

// --- TÖBBI API ÚTVONAL (RECORDS, INVOICES, ASSETS, SHARES) ---
app.get('/api/records', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    if (!(await canAccessData(req.userId, req.userEmail, targetUserId))) return res.status(403).json({ error: "Nincs jogosultság" });
    try {
        const [rows] = await pool.query('SELECT Id, Type, Value, AssetId, DATE_FORMAT(Date, "%Y-%m-%d %H:%i") as FormattedDate FROM utility_records WHERE UserId = ? ORDER BY Date DESC', [targetUserId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

app.get('/api/invoices', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    if (!(await canAccessData(req.userId, req.userEmail, targetUserId))) return res.status(403).json({ error: "Nincs jogosultság" });
    try {
        const [rows] = await pool.query('SELECT * FROM invoices WHERE UserId = ? ORDER BY Month DESC', [targetUserId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

app.get('/api/assets', verifyUser, async (req, res) => {
    const targetUserId = req.query.userId || req.userId;
    if (!(await canAccessData(req.userId, req.userEmail, targetUserId))) return res.status(403).json({ error: "Nincs jogosultság" });
    try {
        const [rows] = await pool.query('SELECT * FROM assets WHERE UserId = ?', [targetUserId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'DB hiba' }); }
});

app.post('/api/shares', verifyUser, async (req, res) => {
    try {
        await pool.query('INSERT INTO shares (owner_id, owner_email, shared_with_email) VALUES (?, ?, ?)', [req.userId, req.userEmail, req.body.sharedWithEmail]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.get('/api/shares/me', verifyUser, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT owner_id, owner_email FROM shares WHERE shared_with_email = ?', [req.userEmail]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.post('/api/records', verifyUser, async (req, res) => {
    const { type, value, date, assetId } = req.body;
    try {
        await pool.query('INSERT INTO utility_records (Type, Value, Date, UserId, AssetId) VALUES (?, ?, ?, ?, ?)', [type, value, date, req.userId, assetId]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.post('/api/invoices', verifyUser, async (req, res) => {
    const { type, amount, date, assetId } = req.body;
    try {
        await pool.query('INSERT INTO invoices (Type, Amount, Month, UserId, AssetId) VALUES (?, ?, ?, ?, ?)', [type, amount, date, req.userId, assetId]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Hiba' }); }
});

app.delete('/api/records/:id', verifyUser, async (req, res) => {
    await pool.query('DELETE FROM utility_records WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
});

app.delete('/api/invoices/:id', verifyUser, async (req, res) => {
    await pool.query('DELETE FROM invoices WHERE Id = ? AND UserId = ?', [req.params.id, req.userId]);
    res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Szerver fut: ${PORT}`));
