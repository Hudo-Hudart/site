// db/mysql_db.js
const mysql = require('mysql2');
// создаём пул соединений
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',       // XAMPP по умолчанию
  password: '',           // если нет пароля
  database: 'petshop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// обёртка для async/await
const db = pool.promise();
module.exports = db;
