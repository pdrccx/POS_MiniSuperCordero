const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Historial de movimientos: ventas y abonos, con filtros de fecha y tipo
// ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=contado|fiado|mixto|abono|cancelada
router.get('/', (req, res) => {
  const { desde, hasta, tipo } = req.query;

  let sqlVentas = `
    SELECT v.id, v.fecha, v.total AS monto, v.tipo_pago, v.monto_cobrado, v.monto_fiado,
           v.cambio, v.cancelada, v.motivo_cancelacion, v.atendio,
           c.nombre AS cliente_nombre, 'venta' AS clase
    FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE 1=1`;
  const paramsVentas = [];

  let sqlAbonos = `
    SELECT m.id, m.fecha, m.monto, m.tipo AS tipo_pago, 0 AS monto_cobrado, 0 AS monto_fiado,
           0 AS cambio, 0 AS cancelada, m.nota AS motivo_cancelacion, m.metodo AS atendio,
           c.nombre AS cliente_nombre, 'abono' AS clase
    FROM movimientos_deuda m JOIN clientes c ON c.id = m.cliente_id
    WHERE m.tipo IN ('abono', 'pago_completo')`;
  const paramsAbonos = [];

  if (desde) {
    sqlVentas += ' AND date(v.fecha) >= date(?)';
    sqlAbonos += ' AND date(m.fecha) >= date(?)';
    paramsVentas.push(desde);
    paramsAbonos.push(desde);
  }
  if (hasta) {
    sqlVentas += ' AND date(v.fecha) <= date(?)';
    sqlAbonos += ' AND date(m.fecha) <= date(?)';
    paramsVentas.push(hasta);
    paramsAbonos.push(hasta);
  }

  let resultados = [];

  if (!tipo || tipo === 'todos') {
    resultados = [
      ...db.prepare(sqlVentas).all(...paramsVentas),
      ...db.prepare(sqlAbonos).all(...paramsAbonos),
    ];
  } else if (tipo === 'abono') {
    resultados = db.prepare(sqlAbonos).all(...paramsAbonos);
  } else if (tipo === 'cancelada') {
    resultados = db.prepare(sqlVentas + ' AND v.cancelada = 1').all(...paramsVentas);
  } else {
    resultados = db
      .prepare(sqlVentas + ' AND v.tipo_pago = ? AND v.cancelada = 0')
      .all(...paramsVentas, tipo);
  }

  resultados.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  res.json(resultados);
});

// Resumen del día (?fecha=YYYY-MM-DD, por defecto hoy)
router.get('/resumen', (req, res) => {
  const fecha = req.query.fecha || new Date().toLocaleDateString('sv-SE');

  const ventas = db.prepare(`
    SELECT v.*, c.nombre AS cliente_nombre
    FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
    WHERE date(v.fecha) = date(?) AND v.cancelada = 0
  `).all(fecha);

  const abonos = db.prepare(`
    SELECT m.*, c.nombre AS cliente_nombre
    FROM movimientos_deuda m JOIN clientes c ON c.id = m.cliente_id
    WHERE date(m.fecha) = date(?) AND m.tipo IN ('abono', 'pago_completo')
  `).all(fecha);

  const suma = (arr, campo) => Math.round(arr.reduce((s, x) => s + (x[campo] || 0), 0) * 100) / 100;

  res.json({
    fecha,
    total_vendido: suma(ventas, 'total'),
    total_cobrado: Math.round((suma(ventas, 'monto_cobrado') + suma(abonos, 'monto')) * 100) / 100,
    total_fiado: suma(ventas, 'monto_fiado'),
    abonos_recibidos: suma(abonos, 'monto'),
    num_ventas: ventas.length,
    ventas_contado: ventas.filter(v => v.tipo_pago === 'contado').length,
    ventas_fiado: ventas.filter(v => v.tipo_pago === 'fiado').length,
    ventas_mixto: ventas.filter(v => v.tipo_pago === 'mixto').length,
    clientes_fiado: [...new Set(ventas.filter(v => v.monto_fiado > 0).map(v => v.cliente_nombre))],
    clientes_abonaron: [...new Set(abonos.map(a => a.cliente_nombre))],
  });
});

module.exports = router;
