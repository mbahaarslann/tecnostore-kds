// app.js
const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config();
const db = require('./config/db');

// --- ROUTERLARI ÇAĞIR ---
const routes = require('./routes'); // Centralized routes

// --- AYARLAR ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- YÖNLENDİRMELER (ROUTES) ---
app.use('/', routes);

// --- SUNUCUYU BAŞLAT ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 TecnoStore KDS Sunucusu http://localhost:${PORT} adresinde yayında!`);
});