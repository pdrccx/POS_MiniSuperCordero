const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Lista de clientes. ?buscar= filtra por nombre, ?con_deuda=1 solo los que deben
router.get('/', (req, res) => {
  const { buscar, con_deuda } = req.query;
  let sql = `
    SELECT c.*,
      (SELECT MAX(fecha) FROM movimientos_deuda m WHERE m.cliente_id = c.id) AS ultimo_movimiento
    FROM clientes c
    WHERE c.activo = 1`;
  const params = [];
  if (buscar) {
    sql += ' AND c.nombre LIKE ?';
    params.push(`%${buscar}%`);
  }
  if (con_deuda) sql += ' AND c.deuda_actual > 0';
  sql += ' ORDER BY c.nombre';
  res.json(db.prepare(sql).all(...params));
});

// Perfil de cliente con su historial de movimientos
router.get('/:id', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const movimientos = db.prepare(`
    SELECT m.*, v.tipo_pago AS venta_tipo, v.total AS venta_total
    FROM movimientos_deuda m
    LEFT JOIN ventas v ON v.id = m.venta_id
    WHERE m.cliente_id = ?
    ORDER BY m.fecha DESC, m.id DESC
  `).all(req.params.id);

  res.json({ ...cliente, movimientos });
});

router.post('/', (req, res) => {
  const { nombre, telefono } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const info = db
    .prepare('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)')
    .run(nombre.trim(), telefono ? telefono.trim() : null);
  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { nombre, telefono, activo } = req.body;
  db.prepare('UPDATE clientes SET nombre = ?, telefono = ?, activo = ? WHERE id = ?').run(
    nombre ? nombre.trim() : existente.nombre,
    telefono === undefined ? existente.telefono : (telefono ? telefono.trim() : null),
    activo === undefined ? existente.activo : (activo ? 1 : 0),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id));
});

// Registrar un abono o pago completo
router.post('/:id/abono', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { monto, metodo, nota, pago_completo } = req.body;
  const montoAbono = pago_completo ? cliente.deuda_actual : Number(monto);

  if (!montoAbono || montoAbono <= 0) {
    return res.status(400).json({ error: 'El monto del abono no es válido' });
  }
  if (montoAbono > cliente.deuda_actual + 0.001) {
    return res.status(400).json({ error: 'El abono es mayor que la deuda actual' });
  }
  if (metodo && !['efectivo', 'transferencia'].includes(metodo)) {
    return res.status(400).json({ error: 'Método de pago no válido' });
  }

  const registrar = db.transaction(() => {
    const nuevaDeuda = Math.max(0, Math.round((cliente.deuda_actual - montoAbono) * 100) / 100);
    const tipo = nuevaDeuda === 0 ? 'pago_completo' : 'abono';
    db.prepare(
      'INSERT INTO movimientos_deuda (cliente_id, tipo, monto, metodo, nota) VALUES (?, ?, ?, ?, ?)'
    ).run(cliente.id, tipo, montoAbono, metodo || 'efectivo', nota || null);
    db.prepare('UPDATE clientes SET deuda_actual = ? WHERE id = ?').run(nuevaDeuda, cliente.id);
    return nuevaDeuda;
  });

  const nuevaDeuda = registrar();
  res.json({ ok: true, deuda_actual: nuevaDeuda, pagado_completo: nuevaDeuda === 0 });
});

module.exports = router;
