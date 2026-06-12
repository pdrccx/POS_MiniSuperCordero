const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Lista de productos. ?buscar= filtra por código o nombre, ?todos=1 incluye inactivos
router.get('/', (req, res) => {
  const { buscar, todos } = req.query;
  let sql = 'SELECT * FROM productos';
  const condiciones = [];
  const params = [];

  if (!todos) condiciones.push('activo = 1');
  if (buscar) {
    condiciones.push('(codigo LIKE ? OR nombre LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`);
  }
  if (condiciones.length) sql += ' WHERE ' + condiciones.join(' AND ');
  sql += ' ORDER BY nombre';

  res.json(db.prepare(sql).all(...params));
});

// Busca un producto por código exacto (sin importar mayúsculas)
router.get('/codigo/:codigo', (req, res) => {
  const producto = db
    .prepare('SELECT * FROM productos WHERE UPPER(codigo) = UPPER(?) AND activo = 1')
    .get(req.params.codigo);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

router.post('/', (req, res) => {
  const { codigo, nombre, tipo, precio } = req.body;
  if (!codigo || !nombre || !tipo) {
    return res.status(400).json({ error: 'Faltan datos del producto' });
  }
  if (!['normal', 'pesable', 'suelto'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de producto no válido' });
  }
  try {
    const info = db
      .prepare('INSERT INTO productos (codigo, nombre, tipo, precio) VALUES (?, ?, ?, ?)')
      .run(codigo.trim().toUpperCase(), nombre.trim(), tipo, precio ?? null);
    res.json(db.prepare('SELECT * FROM productos WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ya existe un producto con ese código' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Producto no encontrado' });

  const { codigo, nombre, tipo, precio, activo } = req.body;
  try {
    db.prepare(
      'UPDATE productos SET codigo = ?, nombre = ?, tipo = ?, precio = ?, activo = ? WHERE id = ?'
    ).run(
      (codigo ?? existente.codigo).trim().toUpperCase(),
      (nombre ?? existente.nombre).trim(),
      tipo ?? existente.tipo,
      precio === undefined ? existente.precio : precio,
      activo === undefined ? existente.activo : (activo ? 1 : 0),
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ya existe un producto con ese código' });
    }
    throw e;
  }
});

module.exports = router;
