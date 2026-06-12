// Resumen del día
pintarEncabezado('resumen');

const hoy = () => new Date().toLocaleDateString('sv-SE');

async function cargarResumen() {
  const fecha = $('#fecha-resumen').value || hoy();
  const r = await api('/api/historial/resumen?fecha=' + fecha);

  $('#r-vendido').textContent = dinero(r.total_vendido);
  $('#r-cobrado').textContent = dinero(r.total_cobrado);
  $('#r-fiado').textContent = dinero(r.total_fiado);
  $('#r-abonos').textContent = dinero(r.abonos_recibidos);
  $('#r-num-ventas').textContent = r.num_ventas;
  $('#r-contado').textContent = r.ventas_contado;
  $('#r-fiadas').textContent = r.ventas_fiado;
  $('#r-mixtas').textContent = r.ventas_mixto;

  $('#r-clientes-fiado').textContent = r.clientes_fiado.length
    ? r.clientes_fiado.join(', ')
    : 'Nadie todavía.';
  $('#r-clientes-abonaron').textContent = r.clientes_abonaron.length
    ? r.clientes_abonaron.join(', ')
    : 'Nadie todavía.';
}

$('#fecha-resumen').value = hoy();
$('#fecha-resumen').addEventListener('change', cargarResumen);
$('#btn-hoy').onclick = () => {
  $('#fecha-resumen').value = hoy();
  cargarResumen();
};

cargarResumen();
