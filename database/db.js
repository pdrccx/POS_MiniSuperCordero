// Conexión a la base de datos y creación de tablas
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'tienda.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('normal', 'pesable', 'suelto')),
  precio REAL,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  deuda_actual REAL DEFAULT 0,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  total REAL NOT NULL,
  tipo_pago TEXT NOT NULL CHECK(tipo_pago IN ('contado', 'fiado', 'mixto')),
  monto_cobrado REAL DEFAULT 0,
  monto_fiado REAL DEFAULT 0,
  cambio REAL DEFAULT 0,
  cliente_id INTEGER REFERENCES clientes(id),
  cancelada INTEGER DEFAULT 0,
  motivo_cancelacion TEXT,
  atendio TEXT
);

CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id),
  producto_id INTEGER REFERENCES productos(id),
  descripcion TEXT NOT NULL,
  cantidad REAL DEFAULT 1,
  precio_unitario REAL,
  importe REAL NOT NULL,
  es_pesable INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS movimientos_deuda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  venta_id INTEGER REFERENCES ventas(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('cargo', 'abono', 'pago_completo', 'cancelacion')),
  monto REAL NOT NULL,
  metodo TEXT CHECK(metodo IN ('efectivo', 'transferencia')),
  nota TEXT,
  fecha TEXT DEFAULT (datetime('now','localtime'))
);
`);

module.exports = db;
