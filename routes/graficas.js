const express = require('express');
const db = require('../database/db');

const router = express.Router();

// Datos para las gráficas de deudores. ?mes=YYYY-MM (por defecto el mes actual)
router.get('/', (req, res) => {
  const mes = req.query.mes || new Date().toLocaleDateString('sv-SE').slice(0, 7);

  // Quién debe más ahorita
  const debenMas = db.prepare(`
    SELECT nombre, deuda_actual AS monto
    FROM clientes
    WHERE activo = 1 AND deuda_actual > 0
    ORDER BY deuda_actual DESC
    LIMIT 10
  `).all();

  // Quién pagó más en el mes (abonos + pagos completos)
  const pagaronMes = db.prepare(`
    SELECT c.nombre, ROUND(SUM(m.monto), 2) AS monto
    FROM movimientos_deuda m
    JOIN clientes c ON c.id = m.cliente_id
    WHERE m.tipo IN ('abono', 'pago_completo') AND strftime('%Y-%m', m.fecha) = ?
    GROUP BY m.cliente_id
    ORDER BY monto DESC
    LIMIT 10
  `).all(mes);

  // Quién pidió más fiado en el mes
  const fiaronMes = db.prepare(`
    SELECT c.nombre, ROUND(SUM(m.monto), 2) AS monto
    FROM movimientos_deuda m
    JOIN clientes c ON c.id = m.cliente_id
    WHERE m.tipo = 'cargo' AND strftime('%Y-%m', m.fecha) = ?
    GROUP BY m.cliente_id
    ORDER BY monto DESC
    LIMIT 10
  `).all(mes);

  // Quién lleva más tiempo sin pagar (días desde su último abono;
  // si nunca ha abonado, desde su primera compra fiada)
  const sinPagar = db.prepare(`
    SELECT c.nombre, c.deuda_actual AS monto,
      CAST(julianday('now','localtime') - julianday(
        COALESCE(
          (SELECT MAX(m.fecha) FROM movimientos_deuda m
           WHERE m.cliente_id = c.id AND m.tipo IN ('abono', 'pago_completo')),
          (SELECT MIN(m.fecha) FROM movimientos_deuda m
           WHERE m.cliente_id = c.id AND m.tipo = 'cargo')
        )
      ) AS INTEGER) AS dias
    FROM clientes c
    WHERE c.activo = 1 AND c.deuda_actual > 0
    ORDER BY dias DESC
    LIMIT 10
  `).all();

  res.json({ mes, deben_mas: debenMas, pagaron_mes: pagaronMes, fiaron_mes: fiaronMes, sin_pagar: sinPagar });
});

module.exports = router;
