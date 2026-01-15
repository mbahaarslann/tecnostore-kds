// config/db.js
const mysql = require('mysql2');
require('dotenv').config(); // Şifreleri gizli dosyadan okumak için

// Bağlantı Havuzu (Pool) Oluşturuyoruz
// Bu yöntem, tek bir bağlantı yerine ihtiyaç oldukça açılıp kapanan verimli bir yöntemdir.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'tecnostore_kds',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Bağlantıyı dışarıya (diğer dosyalara) açıyoruz
// promise() kullanıyoruz ki async/await ile rahatça kod yazabilelim.
module.exports = pool.promise();