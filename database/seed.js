// Productos de ejemplo que se insertan la primera vez que corre el sistema
const db = require('./db');

function seed() {
  const cuantos = db.prepare('SELECT COUNT(*) AS n FROM productos').get().n;
  if (cuantos > 0) return;

  const insertar = db.prepare(
    'INSERT INTO productos (codigo, nombre, tipo, precio) VALUES (?, ?, ?, ?)'
  );

  const productos = [
    ['BOL',  'Bolillo',       'suelto',  2.0],
    ['PAN1', 'Pan dulce',     'suelto',  5.0],
    ['CH01', 'Chicles Adams', 'normal',  4.0],
    ['MAN1', 'Manzana',       'pesable', null],
    ['AZU',  'Azúcar',        'pesable', null],
    ['ARR',  'Arroz',         'pesable', null],
  ];

  const meter = db.transaction(() => {
    for (const p of productos) insertar.run(...p);
  });
  meter();
  console.log('Productos de ejemplo creados.');
}

module.exports = seed;
