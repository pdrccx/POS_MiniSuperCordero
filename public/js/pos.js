// Punto de Venta — pantalla principal
pintarEncabezado('pos');

const buscador = $('#buscador');
const cajaSugerencias = $('#sugerencias');
const cuerpoCarrito = $('#carrito');

let carrito = []; // { producto_id, codigo, descripcion, tipo, cantidad, precio_unitario, importe, manual }
let filaSeleccionada = null;
let sugerencias = [];
let resaltada = -1;

// ============ Carrito ============

function totalCarrito() {
  return Math.round(carrito.reduce((s, it) => s + (Number(it.importe) || 0), 0) * 100) / 100;
}

function recalcular(item) {
  if (!item.manual) {
    item.importe = Math.round(item.cantidad * item.precio_unitario * 100) / 100;
  }
}

function pintarCarrito(enfocarImporteIdx = -1) {
  cuerpoCarrito.innerHTML = '';

  if (carrito.length === 0) {
    cuerpoCarrito.innerHTML =
      '<tr id="carrito-vacio"><td colspan="6" class="suave centrado">El carrito está vacío. Busca un producto arriba.</td></tr>';
    filaSeleccionada = null;
  }

  carrito.forEach((item, i) => {
    const tr = document.createElement('tr');
    if (i === filaSeleccionada) tr.classList.add('seleccionada');

    const celdaImporte = item.manual
      ? `<input type="number" min="0" step="0.5" value="${item.importe || ''}" data-campo="importe" data-i="${i}" placeholder="0.00">`
      : `<strong>${dinero(item.importe)}</strong>`;

    tr.innerHTML = `
      <td>${escaparHtml(item.codigo)}</td>
      <td>${escaparHtml(item.descripcion)}</td>
      <td><input type="number" min="0.01" step="any" value="${item.cantidad}" data-campo="cantidad" data-i="${i}"></td>
      <td class="derecha suave">${item.precio_unitario != null ? dinero(item.precio_unitario) : '—'}</td>
      <td class="derecha">${celdaImporte}</td>
      <td><button class="boton boton-chico boton-rojo" data-quitar="${i}">Quitar</button></td>`;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('input, button')) return;
      filaSeleccionada = i;
      $$('#carrito tr').forEach((f) => f.classList.remove('seleccionada'));
      tr.classList.add('seleccionada');
    });

    cuerpoCarrito.appendChild(tr);
  });

  $$('#carrito [data-campo]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const item = carrito[Number(inp.dataset.i)];
      const valor = Number(inp.value);
      if (inp.dataset.campo === 'cantidad') {
        item.cantidad = valor > 0 ? valor : 1;
      } else {
        item.importe = valor >= 0 ? Math.round(valor * 100) / 100 : 0;
      }
      recalcular(item);
      pintarCarrito();
    });
    // Enter dentro de un campo del carrito regresa al buscador
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.stopPropagation(); inp.blur(); buscador.focus(); }
    });
  });

  $$('#carrito [data-quitar]').forEach((btn) => {
    btn.onclick = () => {
      carrito.splice(Number(btn.dataset.quitar), 1);
      filaSeleccionada = null;
      pintarCarrito();
    };
  });

  $('#total').innerHTML = `<span class="etiqueta">Total</span>${dinero(totalCarrito())}`;

  if (enfocarImporteIdx >= 0) {
    const campo = $(`#carrito [data-campo="importe"][data-i="${enfocarImporteIdx}"]`);
    if (campo) { campo.focus(); campo.select(); }
  }
}

function agregarProducto(producto) {
  // manual = el importe se escribe a mano (pesables o productos sin precio)
  const manual = producto.tipo === 'pesable' || producto.precio == null;

  if (!manual) {
    const existente = carrito.find((it) => it.producto_id === producto.id && !it.manual);
    if (existente) {
      existente.cantidad += 1;
      recalcular(existente);
      pintarCarrito();
      limpiarBuscador();
      return;
    }
  }

  carrito.push({
    producto_id: producto.id,
    codigo: producto.codigo,
    descripcion: producto.nombre,
    tipo: producto.tipo,
    cantidad: 1,
    precio_unitario: producto.precio ?? null,
    importe: manual ? 0 : producto.precio,
    manual,
  });

  limpiarBuscador();
  pintarCarrito(manual ? carrito.length - 1 : -1);
  if (!manual) buscador.focus();
}

function limpiarBuscador() {
  buscador.value = '';
  cajaSugerencias.classList.remove('visible');
  sugerencias = [];
  resaltada = -1;
}

// ============ Buscador con sugerencias ============

let temporizadorBusqueda = null;

buscador.addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  const texto = buscador.value.trim();
  if (!texto) { limpiarBuscador(); return; }
  temporizadorBusqueda = setTimeout(async () => {
    try {
      sugerencias = (await api('/api/productos?buscar=' + encodeURIComponent(texto))).slice(0, 8);
      resaltada = sugerencias.length ? 0 : -1;
      pintarSugerencias();
    } catch { /* sin conexión momentánea, no pasa nada */ }
  }, 150);
});

function pintarSugerencias() {
  if (!sugerencias.length) { cajaSugerencias.classList.remove('visible'); return; }
  cajaSugerencias.innerHTML = sugerencias.map((p, i) => `
    <div class="sugerencia ${i === resaltada ? 'resaltada' : ''}" data-i="${i}">
      <span><strong>${escaparHtml(p.codigo)}</strong> — ${escaparHtml(p.nombre)}</span>
      <span class="suave">${p.precio != null ? dinero(p.precio) : 'importe manual'}</span>
    </div>`).join('');
  cajaSugerencias.classList.add('visible');
  $$('.sugerencia', cajaSugerencias).forEach((el) => {
    el.onclick = () => agregarProducto(sugerencias[Number(el.dataset.i)]);
  });
}

buscador.addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowDown' && sugerencias.length) {
    e.preventDefault();
    resaltada = (resaltada + 1) % sugerencias.length;
    pintarSugerencias();
  } else if (e.key === 'ArrowUp' && sugerencias.length) {
    e.preventDefault();
    resaltada = (resaltada - 1 + sugerencias.length) % sugerencias.length;
    pintarSugerencias();
  } else if (e.key === 'Enter') {
    const texto = buscador.value.trim();
    if (!texto) return; // lo maneja la lógica global (abrir cobro)
    e.preventDefault();
    // Primero: código exacto
    const porCodigo = sugerencias.find((p) => p.codigo.toUpperCase() === texto.toUpperCase());
    if (porCodigo) return agregarProducto(porCodigo);
    try {
      const producto = await api('/api/productos/codigo/' + encodeURIComponent(texto));
      return agregarProducto(producto);
    } catch { /* no hay código exacto, probamos sugerencia */ }
    if (resaltada >= 0 && sugerencias[resaltada]) return agregarProducto(sugerencias[resaltada]);
    aviso('Producto no encontrado', true);
  }
});

// ============ Teclado global ============

document.addEventListener('keydown', async (e) => {
  const modalAbierto = $$('.modal-fondo.visible').length > 0;

  if (e.key === 'Enter' && !modalAbierto) {
    const escribiendo = e.target instanceof Element
      && e.target.matches('input, textarea, select') && e.target !== buscador;
    if (!escribiendo && !buscador.value.trim() && carrito.length > 0) {
      e.preventDefault();
      abrirCobro();
    }
  }

  if (e.key === 'Escape' && !modalAbierto) {
    if (buscador.value.trim()) {
      limpiarBuscador();
      buscador.focus();
    } else if (carrito.length > 0) {
      if (await confirmar('¿Quieres limpiar el carrito? Se quitarán todos los productos.', 'Sí, limpiar')) {
        carrito = [];
        pintarCarrito();
        buscador.focus();
      }
    }
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.buscador-caja')) cajaSugerencias.classList.remove('visible');
});

// ============ Botones principales ============

$('#btn-cobrar').onclick = () => {
  if (carrito.length === 0) return aviso('El carrito está vacío', true);
  abrirCobro();
};

$('#btn-limpiar').onclick = async () => {
  if (carrito.length === 0) return;
  if (await confirmar('¿Quieres limpiar el carrito? Se quitarán todos los productos.', 'Sí, limpiar')) {
    carrito = [];
    pintarCarrito();
    buscador.focus();
  }
};

$('#btn-quitar-sel').onclick = () => {
  if (filaSeleccionada == null || !carrito[filaSeleccionada]) {
    return aviso('Primero toca un producto del carrito para seleccionarlo', true);
  }
  carrito.splice(filaSeleccionada, 1);
  filaSeleccionada = null;
  pintarCarrito();
};

// ============ Ventana de cobro ============

const modalCobro = $('#modal-cobro');
let tipoPago = null;
let clienteElegido = null;
let usandoClienteNuevo = false;

function abrirCobro() {
  const importeVacio = carrito.find((it) => it.manual && (!it.importe || it.importe <= 0));
  if (importeVacio) {
    return aviso(`Falta escribir el importe de: ${importeVacio.descripcion}`, true);
  }

  tipoPago = null;
  clienteElegido = null;
  usandoClienteNuevo = false;
  $('#cobro-total').textContent = dinero(totalCarrito());
  $$('.opcion-pago').forEach((b) => b.classList.remove('activa'));
  $('#pago-contado').hidden = true;
  $('#pago-mixto-monto').hidden = true;
  $('#pago-cliente').hidden = true;
  $('#form-cliente-nuevo').hidden = true;
  $('#cliente-elegido').hidden = true;
  $('#pago-recibido').value = '';
  $('#pago-ahorita').value = '';
  $('#buscar-cliente').value = '';
  $('#nuevo-nombre').value = '';
  $('#nuevo-telefono').value = '';
  $('#cambio').textContent = '$0.00';
  $('#resto-fiado').textContent = dinero(totalCarrito());
  $('#btn-confirmar-venta').disabled = true;
  modalCobro.classList.add('visible');
}

function cerrarCobro() {
  modalCobro.classList.remove('visible');
  buscador.focus();
}

$('#btn-cancelar-cobro').onclick = cerrarCobro;

modalCobro.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.stopPropagation(); cerrarCobro(); }
  if (e.key === 'Enter' && !$('#btn-confirmar-venta').disabled && !e.target.matches('button')) {
    e.preventDefault();
    $('#btn-confirmar-venta').click();
  }
});

$$('.opcion-pago').forEach((btn) => {
  btn.onclick = () => {
    tipoPago = btn.dataset.pago;
    $$('.opcion-pago').forEach((b) => b.classList.toggle('activa', b === btn));
    $('#pago-contado').hidden = tipoPago !== 'contado';
    $('#pago-mixto-monto').hidden = tipoPago !== 'mixto';
    $('#pago-cliente').hidden = tipoPago === 'contado';
    validarCobro();
    if (tipoPago === 'contado') $('#pago-recibido').focus();
    if (tipoPago === 'mixto') $('#pago-ahorita').focus();
    if (tipoPago === 'fiado') $('#buscar-cliente').focus();
  };
});

function validarCobro() {
  const total = totalCarrito();
  let valido = false;

  if (tipoPago === 'contado') {
    const pagado = Number($('#pago-recibido').value);
    const cambio = pagado - total;
    $('#cambio').textContent = dinero(Math.max(0, cambio));
    valido = pagado >= total;
  } else if (tipoPago === 'fiado') {
    valido = !!clienteElegido || (usandoClienteNuevo && $('#nuevo-nombre').value.trim().length > 0);
  } else if (tipoPago === 'mixto') {
    const pagado = Number($('#pago-ahorita').value);
    const resto = Math.round((total - pagado) * 100) / 100;
    $('#resto-fiado').textContent = dinero(Math.max(0, resto));
    const montoBien = pagado > 0 && pagado < total;
    const clienteBien = !!clienteElegido || (usandoClienteNuevo && $('#nuevo-nombre').value.trim().length > 0);
    valido = montoBien && clienteBien;
  }

  $('#btn-confirmar-venta').disabled = !valido;
}

$('#pago-recibido').addEventListener('input', validarCobro);
$('#pago-ahorita').addEventListener('input', validarCobro);
$('#nuevo-nombre').addEventListener('input', validarCobro);

$('#btn-pago-exacto').onclick = () => {
  $('#pago-recibido').value = totalCarrito();
  validarCobro();
};

// --- Buscador de cliente ---
let temporizadorCliente = null;

$('#buscar-cliente').addEventListener('input', () => {
  clearTimeout(temporizadorCliente);
  clienteElegido = null;
  $('#cliente-elegido').hidden = true;
  validarCobro();
  const texto = $('#buscar-cliente').value.trim();
  if (!texto) { $('#sugerencias-cliente').classList.remove('visible'); return; }
  temporizadorCliente = setTimeout(async () => {
    try {
      const clientes = (await api('/api/clientes?buscar=' + encodeURIComponent(texto))).slice(0, 8);
      const caja = $('#sugerencias-cliente');
      if (!clientes.length) {
        caja.innerHTML = '<div class="sugerencia suave">No se encontró. Puedes registrarlo abajo.</div>';
        caja.classList.add('visible');
        return;
      }
      caja.innerHTML = clientes.map((c, i) => `
        <div class="sugerencia" data-i="${i}">
          <span>${escaparHtml(c.nombre)}</span>
          <span class="suave">debe ${dinero(c.deuda_actual)}</span>
        </div>`).join('');
      caja.classList.add('visible');
      $$('.sugerencia[data-i]', caja).forEach((el) => {
        el.onclick = () => elegirCliente(clientes[Number(el.dataset.i)]);
      });
    } catch { /* nada */ }
  }, 150);
});

function elegirCliente(cliente) {
  clienteElegido = cliente;
  usandoClienteNuevo = false;
  $('#form-cliente-nuevo').hidden = true;
  $('#buscar-cliente').value = cliente.nombre;
  $('#sugerencias-cliente').classList.remove('visible');
  $('#cliente-nombre').textContent = cliente.nombre;
  $('#cliente-deuda').textContent = dinero(cliente.deuda_actual);
  $('#cliente-elegido').hidden = false;
  validarCobro();
}

$('#btn-cliente-nuevo').onclick = () => {
  usandoClienteNuevo = true;
  clienteElegido = null;
  $('#cliente-elegido').hidden = true;
  $('#form-cliente-nuevo').hidden = false;
  $('#nuevo-nombre').focus();
  validarCobro();
};

// --- Confirmar venta ---
$('#btn-confirmar-venta').onclick = async () => {
  const total = totalCarrito();
  const nombreCliente = clienteElegido ? clienteElegido.nombre : $('#nuevo-nombre').value.trim();

  if (tipoPago !== 'contado') {
    const montoFiado = tipoPago === 'fiado'
      ? total
      : Math.round((total - Number($('#pago-ahorita').value)) * 100) / 100;
    const ok = await confirmar(
      `Se guardará una deuda de ${dinero(montoFiado)} para <strong>${escaparHtml(nombreCliente)}</strong>. ¿Confirmar?`,
      'Sí, confirmar'
    );
    if (!ok) return;
  }

  const boton = $('#btn-confirmar-venta');
  boton.disabled = true;

  try {
    const respuesta = await api('/api/ventas', {
      method: 'POST',
      body: {
        items: carrito.map((it) => ({
          producto_id: it.producto_id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          importe: it.importe,
          es_pesable: it.tipo === 'pesable',
        })),
        tipo_pago: tipoPago,
        monto_pagado: tipoPago === 'contado'
          ? Number($('#pago-recibido').value)
          : tipoPago === 'mixto' ? Number($('#pago-ahorita').value) : 0,
        cliente_id: clienteElegido ? clienteElegido.id : null,
        cliente_nuevo: usandoClienteNuevo
          ? { nombre: $('#nuevo-nombre').value.trim(), telefono: $('#nuevo-telefono').value.trim() }
          : null,
        atendio: turnoActual(),
      },
    });
    modalCobro.classList.remove('visible');
    mostrarTicket(respuesta);
  } catch (e) {
    aviso(e.message, true);
    boton.disabled = false;
  }
};

// ============ Ticket simbólico ============

function mostrarTicket({ venta, detalle, cliente }) {
  const nombresPago = { contado: 'Al contado', fiado: 'Fiado', mixto: 'Mitad y mitad' };

  let lineas = detalle.map((d) => `
    <div class="linea">
      <span>${d.cantidad != 1 ? d.cantidad + ' x ' : ''}${escaparHtml(d.descripcion)}</span>
      <span>${dinero(d.importe)}</span>
    </div>`).join('');

  let extra = '';
  if (venta.tipo_pago === 'contado') {
    extra = `
      <div class="linea"><span>Pagó</span><span>${dinero(venta.monto_cobrado + venta.cambio)}</span></div>
      <div class="linea"><span>Cambio</span><span>${dinero(venta.cambio)}</span></div>`;
  } else {
    extra = `
      ${venta.tipo_pago === 'mixto' ? `<div class="linea"><span>Pagó ahorita</span><span>${dinero(venta.monto_cobrado)}</span></div>` : ''}
      <div class="linea"><span>Quedó fiado</span><span>${dinero(venta.monto_fiado)}</span></div>
      <div class="linea"><span>Cliente</span><span>${escaparHtml(cliente ? cliente.nombre : '')}</span></div>
      <div class="linea"><span>Ahora debe en total</span><span class="rojo">${cliente ? dinero(cliente.deuda_actual) : ''}</span></div>`;
  }

  $('#ticket-contenido').innerHTML = `
    <h2 class="centrado" style="margin:0;">Mini Super Cordero</h2>
    <p class="centrado suave" style="margin:6px 0;">${fechaBonita(venta.fecha)} · Atendió: ${escaparHtml(venta.atendio || '')}</p>
    <hr>
    ${lineas}
    <hr>
    <div class="linea ticket-total"><span>Total</span><span>${dinero(venta.total)}</span></div>
    <div class="linea"><span>Tipo de pago</span><span>${nombresPago[venta.tipo_pago]}</span></div>
    ${extra}`;

  $('#modal-ticket').classList.add('visible');
  $('#btn-cerrar-ticket').focus();
}

$('#btn-cerrar-ticket').onclick = () => {
  $('#modal-ticket').classList.remove('visible');
  carrito = [];
  filaSeleccionada = null;
  pintarCarrito();
  aviso('Venta guardada correctamente');
  buscador.focus();
};

// Arranque
pintarCarrito();
buscador.focus();
