// Catálogo de productos
pintarEncabezado('productos');

const lista = $('#lista-productos');
const modalProducto = $('#modal-producto');
let productos = [];
let editandoId = null;

const nombresTipo = { normal: 'Normal', pesable: 'Pesable', suelto: 'Suelto' };

async function cargar() {
  const buscar = $('#buscar-producto').value.trim();
  productos = await api('/api/productos?todos=1' + (buscar ? '&buscar=' + encodeURIComponent(buscar) : ''));
  pintar();
}

function pintar() {
  if (!productos.length) {
    lista.innerHTML = '<tr><td colspan="6" class="suave centrado">No hay productos que mostrar.</td></tr>';
    return;
  }
  lista.innerHTML = productos.map((p) => `
    <tr style="${p.activo ? '' : 'opacity:0.45;'}">
      <td><strong>${escaparHtml(p.codigo)}</strong></td>
      <td>${escaparHtml(p.nombre)}</td>
      <td>${nombresTipo[p.tipo]}</td>
      <td class="derecha">${p.precio != null ? dinero(p.precio) : '—'}</td>
      <td>${p.activo ? '<span class="morado">Activo</span>' : '<span class="suave">Inactivo</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="boton boton-chico boton-gris" data-editar="${p.id}">Editar</button>
        <button class="boton boton-chico ${p.activo ? 'boton-rojo' : 'boton-morado'}" data-toggle="${p.id}">
          ${p.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>`).join('');

  $$('[data-editar]', lista).forEach((b) => {
    b.onclick = () => abrirFormulario(productos.find((p) => p.id === Number(b.dataset.editar)));
  });
  $$('[data-toggle]', lista).forEach((b) => {
    b.onclick = async () => {
      const p = productos.find((x) => x.id === Number(b.dataset.toggle));
      if (p.activo) {
        const ok = await confirmar(
          `¿Desactivar <strong>${escaparHtml(p.nombre)}</strong>? Ya no aparecerá en el punto de venta, pero su historial se conserva.`,
          'Sí, desactivar'
        );
        if (!ok) return;
      }
      await api('/api/productos/' + p.id, { method: 'PUT', body: { activo: p.activo ? 0 : 1 } });
      aviso(p.activo ? 'Producto desactivado' : 'Producto activado');
      cargar();
    };
  });
}

function abrirFormulario(producto = null) {
  editandoId = producto ? producto.id : null;
  $('#titulo-form').textContent = producto ? 'Editar producto' : 'Agregar producto';
  $('#campo-codigo').value = producto ? producto.codigo : '';
  $('#campo-nombre').value = producto ? producto.nombre : '';
  $('#campo-tipo').value = producto ? producto.tipo : 'normal';
  $('#campo-precio').value = producto && producto.precio != null ? producto.precio : '';
  modalProducto.classList.add('visible');
  $('#campo-codigo').focus();
}

$('#btn-agregar').onclick = () => abrirFormulario();
$('#btn-cancelar-producto').onclick = () => modalProducto.classList.remove('visible');

$('#btn-guardar-producto').onclick = async () => {
  const datos = {
    codigo: $('#campo-codigo').value.trim(),
    nombre: $('#campo-nombre').value.trim(),
    tipo: $('#campo-tipo').value,
    precio: $('#campo-precio').value === '' ? null : Number($('#campo-precio').value),
  };
  if (!datos.codigo || !datos.nombre) return aviso('Falta el código o el nombre', true);
  if (datos.tipo !== 'pesable' && datos.precio == null) {
    return aviso('Los productos que no son pesables necesitan precio', true);
  }
  try {
    if (editandoId) {
      await api('/api/productos/' + editandoId, { method: 'PUT', body: datos });
      aviso('Producto actualizado');
    } else {
      await api('/api/productos', { method: 'POST', body: datos });
      aviso('Producto agregado');
    }
    modalProducto.classList.remove('visible');
    cargar();
  } catch (e) {
    aviso(e.message, true);
  }
};

modalProducto.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modalProducto.classList.remove('visible');
});

let temporizador = null;
$('#buscar-producto').addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargar, 200);
});

cargar();
