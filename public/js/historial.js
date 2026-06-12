// Historial de ventas y movimientos
pintarEncabezado('historial');

const listaHistorial = $('#lista-historial');
let ventaACancelar = null;

const hoy = () => new Date().toLocaleDateString('sv-SE');

function inicioSemana() {
  const f = new Date();
  const dia = (f.getDay() + 6) % 7; // lunes = 0
  f.setDate(f.getDate() - dia);
  return f.toLocaleDateString('sv-SE');
}

function inicioMes() {
  const f = new Date();
  return new Date(f.getFullYear(), f.getMonth(), 1).toLocaleDateString('sv-SE');
}

function etiquetaTipo(m) {
  if (m.clase === 'abono') {
    return `<span class="etiqueta-tipo tipo-abono">${m.tipo_pago === 'pago_completo' ? 'Pago completo' : 'Abono'}</span>`;
  }
  if (m.cancelada) return '<span class="etiqueta-tipo tipo-cancelada">Venta cancelada</span>';
  const nombres = { contado: 'Al contado', fiado: 'Fiado', mixto: 'Mitad y mitad' };
  return `<span class="etiqueta-tipo tipo-${m.tipo_pago}">${nombres[m.tipo_pago]}</span>`;
}

async function cargar() {
  const desde = $('#fecha-desde').value;
  const hasta = $('#fecha-hasta').value;
  const tipo = $('#filtro-tipo').value;

  let url = `/api/historial?tipo=${tipo}`;
  if (desde) url += `&desde=${desde}`;
  if (hasta) url += `&hasta=${hasta}`;

  const movimientos = await api(url);

  if (!movimientos.length) {
    listaHistorial.innerHTML = '<tr><td colspan="5" class="suave centrado">No hay movimientos en estas fechas.</td></tr>';
    return;
  }

  listaHistorial.innerHTML = movimientos.map((m) => `
    <tr>
      <td>${fechaBonita(m.fecha)}</td>
      <td>${etiquetaTipo(m)}</td>
      <td>${m.cliente_nombre ? escaparHtml(m.cliente_nombre) : '<span class="suave">—</span>'}</td>
      <td class="derecha"><strong>${dinero(m.monto)}</strong></td>
      <td class="derecha">
        ${m.clase === 'venta' ? `<button class="boton boton-chico boton-gris" data-ver="${m.id}">Ver detalle</button>` : ''}
      </td>
    </tr>
    ${m.clase === 'venta' ? `<tr class="detalle-venta" data-detalle="${m.id}" hidden><td colspan="5"></td></tr>` : ''}
  `).join('');

  $$('[data-ver]', listaHistorial).forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.ver;
      const fila = $(`[data-detalle="${id}"]`);
      if (!fila.hidden) { fila.hidden = true; btn.textContent = 'Ver detalle'; return; }

      const venta = await api('/api/ventas/' + id);
      const celda = fila.querySelector('td');
      celda.innerHTML = `
        <div style="padding:8px 4px;">
          ${venta.detalle.map((d) => `
            <div style="display:flex; justify-content:space-between; padding:3px 0;">
              <span>${d.cantidad != 1 ? d.cantidad + ' x ' : ''}${escaparHtml(d.descripcion)}</span>
              <span>${dinero(d.importe)}</span>
            </div>`).join('')}
          <div class="suave" style="margin-top:8px;">
            Atendió: ${escaparHtml(venta.atendio || '—')}
            ${venta.monto_cobrado > 0 ? ` · Cobrado: ${dinero(venta.monto_cobrado)}` : ''}
            ${venta.monto_fiado > 0 ? ` · Fiado: ${dinero(venta.monto_fiado)}` : ''}
            ${venta.cambio > 0 ? ` · Cambio: ${dinero(venta.cambio)}` : ''}
          </div>
          ${venta.cancelada
            ? `<div class="rojo" style="margin-top:6px;">Cancelada. Motivo: ${escaparHtml(venta.motivo_cancelacion || '')}</div>`
            : `<button class="boton boton-chico boton-rojo" style="margin-top:10px;" data-cancelar="${venta.id}">Cancelar esta venta</button>`}
        </div>`;
      fila.hidden = false;
      btn.textContent = 'Ocultar';

      const btnCancelar = celda.querySelector('[data-cancelar]');
      if (btnCancelar) {
        btnCancelar.onclick = () => {
          ventaACancelar = venta.id;
          $('#motivo-cancelacion').value = '';
          $('#modal-cancelar').classList.add('visible');
          $('#motivo-cancelacion').focus();
        };
      }
    };
  });
}

// Filtros rápidos
$$('[data-rango]').forEach((btn) => {
  btn.onclick = () => {
    const r = btn.dataset.rango;
    $('#fecha-desde').value = r === 'hoy' ? hoy() : r === 'semana' ? inicioSemana() : inicioMes();
    $('#fecha-hasta').value = hoy();
    cargar();
  };
});

$('#fecha-desde').addEventListener('change', cargar);
$('#fecha-hasta').addEventListener('change', cargar);
$('#filtro-tipo').addEventListener('change', cargar);

// Cancelación
$('#btn-no-cancelar').onclick = () => $('#modal-cancelar').classList.remove('visible');

$('#btn-si-cancelar').onclick = async () => {
  const motivo = $('#motivo-cancelacion').value.trim();
  if (!motivo) return aviso('Escribe el motivo de la cancelación', true);
  try {
    await api(`/api/ventas/${ventaACancelar}/cancelar`, { method: 'POST', body: { motivo } });
    $('#modal-cancelar').classList.remove('visible');
    aviso('Venta cancelada. Quedó registrada en el historial.');
    cargar();
  } catch (e) {
    aviso(e.message, true);
  }
};

// Al abrir: mostrar hoy
$('#fecha-desde').value = hoy();
$('#fecha-hasta').value = hoy();
cargar();
