// Deudores: lista, perfil de cliente y abonos
pintarEncabezado('deudores');

let clienteActual = null;
let metodoAbono = 'efectivo';
let esPagoCompleto = false;
let editandoCliente = false;

// ============ Vista general ============

async function cargarLista() {
  const buscar = $('#buscar-deudor').value.trim();
  const soloDeuda = $('#solo-deudores').checked;
  let url = '/api/clientes?';
  if (buscar) url += 'buscar=' + encodeURIComponent(buscar) + '&';
  if (soloDeuda) url += 'con_deuda=1';

  const clientes = await api(url);
  const cuerpo = $('#lista-deudores');

  if (!clientes.length) {
    cuerpo.innerHTML = `<tr><td colspan="3" class="suave centrado">${
      soloDeuda ? 'Nadie debe ahorita. ¡Qué bien!' : 'No se encontraron clientes.'
    }</td></tr>`;
    return;
  }

  cuerpo.innerHTML = clientes.map((c) => `
    <tr data-id="${c.id}" style="cursor:pointer;">
      <td><strong>${escaparHtml(c.nombre)}</strong></td>
      <td class="derecha ${c.deuda_actual > 0 ? 'rojo' : 'suave'}"><strong>${dinero(c.deuda_actual)}</strong></td>
      <td class="suave">${fechaBonita(c.ultimo_movimiento)}</td>
    </tr>`).join('');

  $$('[data-id]', cuerpo).forEach((tr) => {
    tr.onclick = () => abrirPerfil(Number(tr.dataset.id));
  });
}

let temporizador = null;
$('#buscar-deudor').addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargarLista, 200);
});
$('#solo-deudores').addEventListener('change', cargarLista);

// ============ Perfil ============

const nombresMovimiento = (m) => {
  if (m.tipo === 'cargo') {
    return m.venta_tipo === 'mixto'
      ? '<span class="etiqueta-tipo tipo-mixto">Pago parcial (mitad y mitad)</span>'
      : '<span class="etiqueta-tipo tipo-fiado">Compra fiada</span>';
  }
  if (m.tipo === 'abono') return '<span class="etiqueta-tipo tipo-abono">Abono</span>';
  if (m.tipo === 'pago_completo') return '<span class="etiqueta-tipo tipo-abono">Pago completo</span>';
  return '<span class="etiqueta-tipo tipo-cancelada">Cancelación</span>';
};

async function abrirPerfil(id) {
  clienteActual = await api('/api/clientes/' + id);

  $('#perfil-nombre').textContent = clienteActual.nombre;
  $('#perfil-telefono').textContent = clienteActual.telefono
    ? 'Teléfono: ' + clienteActual.telefono
    : 'Sin teléfono registrado';

  const deudaCero = clienteActual.deuda_actual <= 0;
  $('#perfil-deuda').innerHTML = deudaCero
    ? '<span class="etiqueta">Debe actualmente</span><span class="morado">$0.00 — al corriente</span>'
    : `<span class="etiqueta">Debe actualmente</span><span class="rojo">${dinero(clienteActual.deuda_actual)}</span>`;

  const movs = clienteActual.movimientos;
  const ultimoAbono = movs.find((m) => m.tipo === 'abono' || m.tipo === 'pago_completo');
  const ultimaFiada = movs.find((m) => m.tipo === 'cargo');
  $('#perfil-ultimos').textContent =
    `Último abono: ${ultimoAbono ? dinero(ultimoAbono.monto) + ' el ' + fechaBonita(ultimoAbono.fecha) : 'ninguno todavía'}` +
    ` · Última compra fiada: ${ultimaFiada ? dinero(ultimaFiada.monto) + ' el ' + fechaBonita(ultimaFiada.fecha) : 'ninguna'}`;

  $('#btn-abonar').disabled = deudaCero;
  $('#btn-pago-completo').disabled = deudaCero;

  $('#lista-movimientos').innerHTML = movs.length
    ? movs.map((m) => `
      <tr>
        <td>${fechaBonita(m.fecha)}</td>
        <td>${nombresMovimiento(m)}</td>
        <td class="derecha"><strong>${m.tipo === 'cargo' ? '+' : '−'}${dinero(m.monto)}</strong></td>
        <td class="suave">${escaparHtml(m.nota || (m.metodo && m.tipo !== 'cargo' ? 'Pagó con ' + m.metodo : ''))}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="suave centrado">Todavía no hay movimientos.</td></tr>';

  $('#vista-lista').hidden = true;
  $('#vista-perfil').hidden = false;
}

$('#btn-volver').onclick = () => {
  $('#vista-perfil').hidden = true;
  $('#vista-lista').hidden = false;
  cargarLista();
};

// ============ Abonos ============

function abrirAbono(pagoCompleto) {
  esPagoCompleto = pagoCompleto;
  $('#titulo-abono').textContent = pagoCompleto ? 'Pago completo' : 'Registrar abono';
  $('#abono-deuda').textContent = dinero(clienteActual.deuda_actual);
  $('#abono-monto-caja').hidden = pagoCompleto;
  $('#abono-monto').value = '';
  $('#abono-nota').value = '';
  metodoAbono = 'efectivo';
  $$('#modal-abono .opcion-pago').forEach((b) =>
    b.classList.toggle('activa', b.dataset.metodo === 'efectivo'));
  $('#modal-abono').classList.add('visible');
  if (!pagoCompleto) $('#abono-monto').focus();
}

$('#btn-abonar').onclick = () => abrirAbono(false);
$('#btn-pago-completo').onclick = () => abrirAbono(true);
$('#btn-cancelar-abono').onclick = () => $('#modal-abono').classList.remove('visible');

$$('#modal-abono .opcion-pago').forEach((b) => {
  b.onclick = () => {
    metodoAbono = b.dataset.metodo;
    $$('#modal-abono .opcion-pago').forEach((x) => x.classList.toggle('activa', x === b));
  };
});

$('#btn-confirmar-abono').onclick = async () => {
  const monto = esPagoCompleto ? clienteActual.deuda_actual : Number($('#abono-monto').value);
  if (!monto || monto <= 0) return aviso('Escribe cuánto va a abonar', true);
  if (monto > clienteActual.deuda_actual) {
    return aviso('El abono es más que la deuda. Debe ' + dinero(clienteActual.deuda_actual), true);
  }

  const ok = await confirmar(
    `¿Registrar abono de <strong>${dinero(monto)}</strong> para <strong>${escaparHtml(clienteActual.nombre)}</strong>?`,
    'Sí, registrar'
  );
  if (!ok) return;

  try {
    const r = await api(`/api/clientes/${clienteActual.id}/abono`, {
      method: 'POST',
      body: {
        monto,
        pago_completo: esPagoCompleto,
        metodo: metodoAbono,
        nota: $('#abono-nota').value.trim() || null,
      },
    });
    $('#modal-abono').classList.remove('visible');
    aviso(r.pagado_completo
      ? `${clienteActual.nombre} quedó al corriente. ¡Deuda pagada!`
      : `Abono registrado. Ahora debe ${dinero(r.deuda_actual)}`);
    abrirPerfil(clienteActual.id);
  } catch (e) {
    aviso(e.message, true);
  }
};

// ============ Nuevo / editar cliente ============

function abrirFormCliente(editar) {
  editandoCliente = editar;
  $('#titulo-cliente').textContent = editar ? 'Editar cliente' : 'Nuevo cliente';
  $('#cliente-nombre-campo').value = editar ? clienteActual.nombre : '';
  $('#cliente-telefono-campo').value = editar ? (clienteActual.telefono || '') : '';
  $('#modal-cliente').classList.add('visible');
  $('#cliente-nombre-campo').focus();
}

$('#btn-nuevo-cliente').onclick = () => abrirFormCliente(false);
$('#btn-editar-cliente').onclick = () => abrirFormCliente(true);
$('#btn-cancelar-cliente').onclick = () => $('#modal-cliente').classList.remove('visible');

$('#btn-guardar-cliente').onclick = async () => {
  const nombre = $('#cliente-nombre-campo').value.trim();
  const telefono = $('#cliente-telefono-campo').value.trim();
  if (!nombre) return aviso('El nombre es obligatorio', true);
  try {
    if (editandoCliente) {
      await api('/api/clientes/' + clienteActual.id, { method: 'PUT', body: { nombre, telefono } });
      aviso('Cliente actualizado');
      $('#modal-cliente').classList.remove('visible');
      abrirPerfil(clienteActual.id);
    } else {
      await api('/api/clientes', { method: 'POST', body: { nombre, telefono } });
      aviso('Cliente registrado');
      $('#modal-cliente').classList.remove('visible');
      $('#solo-deudores').checked = false;
      cargarLista();
    }
  } catch (e) {
    aviso(e.message, true);
  }
};

// Escape cierra modales
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('#modal-abono').classList.remove('visible');
    $('#modal-cliente').classList.remove('visible');
  }
});

cargarLista();
