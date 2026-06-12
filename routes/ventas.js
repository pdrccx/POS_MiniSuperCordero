const express = require('express');
const db = require('../database/db');

const router = express.Router();

const redondear = (n) => Math.round(Number(n) * 100) / 100;

// Registrar una venta (contado, fiado o mitad y mitad)
router.post('/', (req, res) => {
  const { items, tipo_pago, monto_pagado, cliente_id, cliente_nuevo, atendio } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }
  if (!['contado', 'fiado', 'mixto'].includes(tipo_pago)) {
    return res.status(400).json({ error: 'Tipo de pago no válido' });
  }

  const total = redondear(items.reduce((s, it) => s + Number(it.importe || 0), 0));
  if (total <= 0) {
    return res.status(400).json({ error: 'El total de la venta debe ser mayor a cero' });
  }

  const pagado = redondear(monto_pagado || 0);
  let montoCobrado = 0;
  let montoFiado = 0;
  let cambio = 0;

  if (tipo_pago === 'contado') {
    if (pagado < total) return res.status(400).json({ error: 'El pago no alcanza para el total' });
    montoCobrado = total;
    cambio = redondear(pagado - total);
  } else if (tipo_pago === 'fiado') {
    montoFiado = total;
  } else {
    if (pagado <= 0 || pagado >= total) {
      return res.status(400).json({ error: 'En mitad y mitad, el pago debe ser mayor a cero y menor que el total' });
    }
    montoCobrado = pagado;
    montoFiado = redondear(total - pagado);
  }

  if (montoFiado > 0 && !cliente_id && !(cliente_nuevo && cliente_nuevo.nombre)) {
    return res.status(400).json({ error: 'Para fiar se necesita elegir un cliente' });
  }

  const guardar = db.transaction(() => {
    let clienteId = cliente_id || null;

    if (montoFiado > 0 && !clienteId) {
      const info = db
        .prepare('INSERT INTO clientes (nombre, telefono) VALUES (?, ?)')
        .run(cliente_nuevo.nombre.trim(), cliente_nuevo.telefono ? cliente_nuevo.telefono.trim() : null);
      clienteId = info.lastInsertRowid;
    }

    const infoVenta = db.prepare(`
      INSERT INTO ventas (total, tipo_pago, monto_cobrado, monto_fiado, cambio, cliente_id, atendio)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(total, tipo_pago, montoCobrado, montoFiado, cambio, clienteId, atendio || null);
    const ventaId = infoVenta.lastInsertRowid;

    const insertarDetalle = db.prepare(`
      INSERT INTO detalle_ventas (venta_id, producto_id, descripcion, cantidad, precio_unitario, importe, es_pesable)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      insertarDetalle.run(
        ventaId,
        it.producto_id || null,
        it.descripcion,
        Number(it.cantidad) || 1,
        it.precio_unitario ?? null,
        redondear(it.importe),
        it.es_pesable ? 1 : 0
      );
    }

    let clienteFinal = null;
    if (montoFiado > 0) {
      db.prepare(
        'INSERT INTO movimientos_deuda (cliente_id, venta_id, tipo, monto) VALUES (?, ?, ?, ?)'
      ).run(clienteId, ventaId, 'cargo', montoFiado);
      db.prepare('UPDATE clientes SET deuda_actual = ROUND(deuda_actual + ?, 2) WHERE id = ?')
        .run(montoFiado, clienteId);
      clienteFinal = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);
    }

    return { ventaId, clienteFinal };
  });

  const { ventaId, clienteFinal } = guardar();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  const detalle = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(ventaId);

  res.json({ venta, detalle, cliente: clienteFinal });
});

// Detalle de una venta
router.get('/:id', (req, res) => {
  const venta = db.prepare(`
    SELECT v.*, c.nombre AS cliente_nombre
    FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  const detalle = db.prepare('SELECT * FROM detalle_ventas WHERE venta_id = ?').all(req.params.id);
  res.json({ ...venta, detalle });
});

// Cancelar una venta (queda en el historial con su motivo)
router.post('/:id/cancelar', (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.cancelada) return res.status(400).json({ error: 'Esta venta ya estaba cancelada' });

  const { motivo } = req.body;
  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'Escribe el motivo de la cancelación' });
  }

  const cancelar = db.transaction(() => {
    db.prepare('UPDATE ventas SET cancelada = 1, motivo_cancelacion = ? WHERE id = ?')
      .run(motivo.trim(), venta.id);
    // Si la venta tenía fiado, se le quita esa deuda al cliente
    if (venta.monto_fiado > 0 && venta.cliente_id) {
      db.prepare(
        'INSERT INTO movimientos_deuda (cliente_id, venta_id, tipo, monto, nota) VALUES (?, ?, ?, ?, ?)'
      ).run(venta.cliente_id, venta.id, 'cancelacion', venta.monto_fiado, 'Venta cancelada: ' + motivo.trim());
      db.prepare('UPDATE clientes SET deuda_actual = MAX(0, ROUND(deuda_actual - ?, 2)) WHERE id = ?')
        .run(venta.monto_fiado, venta.cliente_id);
    }
  });
  cancelar();

  res.json({ ok: true });
});

module.exports = router;
