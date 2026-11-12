const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => 'S/ ' + Number(n).toLocaleString('es-PE', {minimumFractionDigits: 2});
const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

let propietarios = [], mascotas = [], tipos = [], servicios = [];

/* Horario de atención: 9:00–18:30 cada 30 min, sin la hora de almuerzo (13:00–14:00). */
function generarHoras(){
  const out = [];
  for (let m = 9 * 60; m < 19 * 60; m += 30){
    if (m >= 13 * 60 && m < 14 * 60) continue;
    out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  }
  return out;
}

function showError(text){ const m = $('msg'); m.textContent = text; m.hidden = !text; }

function resumen(){
  const m = mascotas.find(x => String(x.id_mascota) === $('mascota').value);
  const s = servicios.find(x => String(x.id_servicio) === $('servicio').value);
  const t = tipos.find(x => String(x.id_tipo) === $('tipo').value);
  const f = $('fecha').value, h = $('hora').value;

  $('t-serv').textContent = s ? s.nombre_servicio : 'Elige un servicio';
  $('t-desc').textContent = s ? (t?.descripcion || t?.nombre || '') : 'Aquí verás el resumen de la cita.';
  $('t-masc').textContent = m ? `${m.nombre} (${m.especie})` : '—';
  $('t-fh').textContent = f ? `${f.split('-').reverse().join('/')}${h ? ' · ' + h : ''}` : '—';
  $('t-dur').textContent = s ? `${s.duracion_min} min` : '—';
  $('t-pre').textContent = s ? money(s.precio) : '—';
}

function cargarMascotas(){
  const id = $('propietario').value, sel = $('mascota');
  const lista = mascotas.filter(m => String(m.id_propietario) === id);
  sel.disabled = !id;
  sel.innerHTML = id
    ? (lista.length
        ? '<option value="">— Seleccionar mascota —</option>' + lista.map(m => `<option value="${m.id_mascota}">${esc(m.nombre)} (${esc(m.especie)})</option>`).join('')
        : '<option value="">Este propietario no tiene mascotas registradas</option>')
    : '<option value="">Primero elige un propietario</option>';
  resumen();
}

function cargarServicios(){
  const id = $('tipo').value, sel = $('servicio');
  const lista = servicios.filter(s => String(s.id_tipo) === id);
  sel.disabled = !id;
  sel.innerHTML = id
    ? '<option value="">— Seleccionar servicio —</option>' + lista.map(s => `<option value="${s.id_servicio}">${esc(s.nombre_servicio)} · ${s.duracion_min} min · ${money(s.precio)}</option>`).join('')
    : '<option value="">Primero elige un tipo de servicio</option>';
  resumen();
}

function cargarHoras(){
  $('hora').innerHTML = '<option value="">— Seleccionar —</option>' + generarHoras().map(h => `<option>${h}</option>`).join('');
  $('fecha').min = hoy();
}

async function init(){
  cargarHoras();
  if (SUPABASE_URL.includes('TU-PROYECTO')) {
    $('setup').hidden = false;
    $('propietario').innerHTML = '<option value="">Sin conexión</option>';
    $('tipo').innerHTML = '<option value="">Sin conexión</option>';
    return;
  }

  const [p, m, t, s] = await Promise.all([
    sb.from('propietario').select('*').order('nombre'),
    sb.from('mascota').select('*').order('nombre'),
    sb.from('tipo_servicio').select('*').order('nombre'),
    sb.from('servicio').select('*').order('nombre_servicio')
  ]);

  if (p.error || m.error || t.error || s.error) {
    return showError('Error al cargar datos: ' + (p.error || m.error || t.error || s.error).message);
  }

  propietarios = p.data;
  mascotas = m.data;
  servicios = s.data;
  tipos = t.data.filter(x => servicios.some(q => q.id_tipo === x.id_tipo));

  $('propietario').innerHTML = propietarios.length
    ? '<option value="">— Seleccionar propietario —</option>' + propietarios.map(x => `<option value="${x.id_propietario}">${esc(x.nombre)} ${esc(x.apellido)} (${esc(x.tipo_documento)}: ${esc(x.numero_documento)})</option>`).join('')
    : '<option value="">No hay propietarios registrados</option>';

  $('tipo').innerHTML = tipos.length
    ? '<option value="">— Seleccionar tipo —</option>' + tipos.map(x => `<option value="${x.id_tipo}">${esc(x.nombre)}</option>`).join('')
    : '<option value="">No hay servicios disponibles</option>';
}

$('propietario').addEventListener('change', cargarMascotas);
$('tipo').addEventListener('change', cargarServicios);
['mascota', 'servicio', 'fecha', 'hora'].forEach(id => $(id).addEventListener('change', resumen));

$('frm').addEventListener('submit', async e => {
  e.preventDefault(); showError('');
  const btn = $('send'); btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    // Crear directamente la cita usando las llaves foráneas seleccionadas
    const cita = await sb.from('citas').insert({
      fecha_cita: $('fecha').value,
      hora_cita: $('hora').value,
      estado: 'Pendiente',
      motivo: $('motivo').value.trim() || null,
      id_mascota: Number($('mascota').value),
      id_servicio: Number($('servicio').value)
    }).select('id_cita').single();

    if (cita.error) throw cita.error;
    $('ok-id').textContent = '#' + cita.data.id_cita;
    $('main-grid').hidden = true; $('ok').hidden = false; window.scrollTo(0, 0);
  } catch (err) {
    showError(err.code === '23505'
      ? 'Ese horario ya está ocupado. Elige otra hora u otra fecha.'
      : 'No se pudo registrar la cita: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Agendar cita';
  }
});

$('again').addEventListener('click', () => {
  $('frm').reset();
  cargarMascotas();
  cargarServicios();
  $('ok').hidden = true;
  $('main-grid').hidden = false;
});

init();