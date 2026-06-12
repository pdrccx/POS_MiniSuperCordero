// Gráficas de deudores: barras simples hechas con divs
pintarEncabezado('graficas');

const mesActual = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);

// Pinta una gráfica de barras horizontales dentro de un contenedor.
// datos = [{ nombre, valor }], formato = función para mostrar el valor
function pintarBarras(contenedor, datos, formato, opciones = {}) {
  const caja = $(contenedor);
  if (!datos.length) {
    caja.innerHTML = `<p class="sin-datos">${opciones.vacio || 'No hay datos para mostrar.'}</p>`;
    return;
  }
  const maximo = Math.max(...datos.map((d) => d.valor)) || 1;
  caja.innerHTML = datos.map((d) => {
    const ancho = Math.max(4, Math.round((d.valor / maximo) * 100));
    return `
      <div class="barra-fila">
        <div class="barra-nombre" title="${escaparHtml(d.nombre)}">${escaparHtml(d.nombre)}</div>
        <div class="barra-pista">
          <div style="display:flex; align-items:center;">
            <div class="barra ${opciones.roja ? 'roja' : ''}" style="width:${ancho}%;"></div>
            <span class="barra-valor">${formato(d)}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function cargarGraficas() {
  const mes = $('#mes-graficas').value || mesActual();
  const g = await api('/api/graficas?mes=' + mes);

  pintarBarras('#g-deben',
    g.deben_mas.map((x) => ({ nombre: x.nombre, valor: x.monto })),
    (d) => dinero(d.valor),
    { roja: true, vacio: 'Nadie debe ahorita. ¡Qué bien!' });

  pintarBarras('#g-pagaron',
    g.pagaron_mes.map((x) => ({ nombre: x.nombre, valor: x.monto })),
    (d) => dinero(d.valor),
    { vacio: 'Nadie ha abonado este mes.' });

  pintarBarras('#g-fiaron',
    g.fiaron_mes.map((x) => ({ nombre: x.nombre, valor: x.monto })),
    (d) => dinero(d.valor),
    { vacio: 'Nadie ha pedido fiado este mes.' });

  pintarBarras('#g-sin-pagar',
    g.sin_pagar.map((x) => ({ nombre: x.nombre, valor: x.dias, deuda: x.monto })),
    (d) => (d.valor === 0 ? 'hoy' : d.valor === 1 ? '1 día' : d.valor + ' días') + ` (debe ${dinero(d.deuda)})`,
    { roja: true, vacio: 'Nadie debe ahorita. ¡Qué bien!' });
}

$('#mes-graficas').value = mesActual();
$('#mes-graficas').addEventListener('change', cargarGraficas);
$('#btn-este-mes').onclick = () => {
  $('#mes-graficas').value = mesActual();
  cargarGraficas();
};

cargarGraficas();
