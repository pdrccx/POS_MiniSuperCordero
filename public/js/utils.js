// Utilidades compartidas: encabezado, turno, modales y mensajes

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function dinero(n) {
  return '$' + (Number(n) || 0).toFixed(2);
}

async function api(ruta, opciones = {}) {
  const resp = await fetch(ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(datos.error || 'Algo salió mal. Intenta de nuevo.');
  return datos;
}

// ----- Mensajes flotantes -----
function aviso(texto, esError = false) {
  let caja = $('#avisos');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'avisos';
    document.body.appendChild(caja);
  }
  const el = document.createElement('div');
  el.className = 'aviso' + (esError ? ' error' : '');
  el.textContent = texto;
  caja.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ----- Modal de confirmación -----
function confirmar(texto, textoBoton = 'Sí, continuar') {
  return new Promise((resolver) => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo visible';
    fondo.innerHTML = `
      <div class="modal">
        <p style="font-size:1.15rem; margin-top:0;">${texto}</p>
        <div class="modal-acciones">
          <button class="boton boton-gris" data-r="no">Cancelar</button>
          <button class="boton boton-morado" data-r="si">${textoBoton}</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);
    const cerrar = (r) => { fondo.remove(); resolver(r); };
    fondo.querySelector('[data-r="si"]').onclick = () => cerrar(true);
    fondo.querySelector('[data-r="no"]').onclick = () => cerrar(false);
    fondo.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar(false); }
    });
    fondo.querySelector('[data-r="si"]').focus();
  });
}

// ----- Encabezado compartido -----
function pintarEncabezado(paginaActiva) {
  const turno = localStorage.getItem('turno') || 'Mamá';

  const header = document.createElement('header');
  header.innerHTML = `
    <div class="marca">Mini Super Cordero</div>
    <nav>
      <a href="/" data-pag="pos">Punto de Venta</a>
      <a href="/deudores.html" data-pag="deudores">Deudores</a>
      <a href="/historial.html" data-pag="historial">Historial</a>
      <a href="/resumen.html" data-pag="resumen">Resumen del día</a>
      <a href="/productos.html" data-pag="productos">Productos</a>
      <button id="btn-respaldo">Guardar copia</button>
    </nav>
    <div class="turno">
      <span>Atiende:</span>
      <button data-turno="Mamá">Mamá</button>
      <button data-turno="Hermana">Hermana</button>
    </div>`;
  document.body.prepend(header);

  const activo = header.querySelector(`[data-pag="${paginaActiva}"]`);
  if (activo) activo.classList.add('activo');

  const botonesTurno = $$('[data-turno]', header);
  const marcarTurno = (nombre) => {
    botonesTurno.forEach((b) => b.classList.toggle('activo', b.dataset.turno === nombre));
  };
  marcarTurno(turno);
  botonesTurno.forEach((b) => {
    b.onclick = () => {
      localStorage.setItem('turno', b.dataset.turno);
      marcarTurno(b.dataset.turno);
      aviso(`Ahora atiende: ${b.dataset.turno}`);
    };
  });

  $('#btn-respaldo', header).onclick = () => {
    const enlace = document.createElement('a');
    enlace.href = '/api/respaldo';
    enlace.download = '';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    aviso('Copia guardada correctamente.');
  };
}

function turnoActual() {
  return localStorage.getItem('turno') || 'Mamá';
}

function fechaBonita(fechaSql) {
  if (!fechaSql) return '—';
  const f = new Date(fechaSql.replace(' ', 'T'));
  if (isNaN(f)) return fechaSql;
  return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}
