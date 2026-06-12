const path = require('path');
const fs = require('fs');
const express = require('express');

const db = require('./database/db');
const seed = require('./database/seed');

seed();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/historial', require('./routes/historial'));
app.use('/api/graficas', require('./routes/graficas'));

// Respaldo: descarga una copia de la base de datos
app.get('/api/respaldo', async (req, res) => {
  const hoy = new Date().toLocaleDateString('sv-SE');
  const carpetaTmp = path.join(__dirname, 'respaldos_tmp');
  if (!fs.existsSync(carpetaTmp)) fs.mkdirSync(carpetaTmp);
  const archivo = path.join(carpetaTmp, `tienda_${hoy}.db`);

  try {
    await db.backup(archivo);
    res.download(archivo, `tienda_${hoy}.db`, () => {
      fs.unlink(archivo, () => {});
    });
  } catch (e) {
    console.error('Error al crear respaldo:', e);
    res.status(500).json({ error: 'No se pudo crear la copia' });
  }
});

// Manejo de errores: mensaje claro en español
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Algo salió mal. Intenta de nuevo.' });
});

const PUERTO = 3000;
app.listen(PUERTO, () => {
  console.log('');
  console.log('  Mini Super Cordero está listo.');
  console.log(`  Abre el navegador en: http://localhost:${PUERTO}`);
  console.log('');
  console.log('  Para apagar el sistema, cierra esta ventana.');
});
