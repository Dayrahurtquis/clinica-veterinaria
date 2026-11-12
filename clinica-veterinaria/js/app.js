const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ESTADOS = ['Pendiente','Confirmada','Atendida','Cancelada'];
const ESPECIES = ['Perro','Gato','Ave','Conejo','Roedor','Reptil','Otro'];
const E = {
  propietario: { pk:'id_propietario', title:'Propietarios', one:'propietario', nw:'Nuevo', label:r=>`${r.nombre} ${r.apellido}`, fields:[
    {k:'nombre',l:'Nombre',req:1},{k:'apellido',l:'Apellido',req:1},{k:'telefono',l:'Teléfono'},
    {k:'tipo_documento',l:'Tipo de documento',type:'select',opts:['DNI','Pasaporte','Carné de extranjería','RUC'],req:1},
    {k:'numero_documento',l:'N.º de documento',req:1}]},
  mascota: { pk:'id_mascota', title:'Mascotas', one:'mascota', nw:'Nueva', label:r=>{
      const p = (data.propietario||[]).find(o => o.id_propietario === r.id_propietario);
      return `${r.nombre} (${r.especie})` + (p ? ` – ${p.apellido}` : '');
    }, fields:[
    {k:'nombre',l:'Nombre',req:1},{k:'especie',l:'Especie',type:'select',opts:ESPECIES,req:1},
    {k:'raza',l:'Raza'},{k:'sexo',l:'Sexo',type:'select',opts:['Macho','Hembra']},
    {k:'fecha_nacimiento',l:'Fecha de nacimiento',type:'date'},
    {k:'peso_kg',l:'Peso (kg)',type:'number',step:'0.01',kg:1},
    {k:'id_propietario',l:'Propietario',fk:'propietario',req:1}]},
  tipo_servicio: { pk:'id_tipo', title:'Tipos de servicio', one:'tipo de servicio', nw:'Nuevo', label:r=>r.nombre, fields:[
    {k:'nombre',l:'Nombre',req:1},
    {k:'descripcion',l:'Descripción',type:'textarea',long:1}]},
  servicio: { pk:'id_servicio', title:'Servicios', one:'servicio', nw:'Nuevo', label:r=>r.nombre_servicio, fields:[
    {k:'nombre_servicio',l:'Nombre del servicio',req:1},{k:'precio',l:'Precio',type:'number',step:'0.01',req:1,money:1},
    {k:'duracion_min',l:'Duración (min)',type:'number',step:'1',req:1,min:1},
    {k:'id_tipo',l:'Tipo de servicio',fk:'tipo_servicio'}]},
  citas: { pk:'id_cita', title:'Citas', one:'cita', nw:'Nueva', label:r=>`#${r.id_cita}`, fields:[
    {k:'fecha_cita',l:'Fecha',type:'date',req:1,today:1},
    {k:'hora_cita',l:'Hora',type:'time',req:1},
    {k:'estado',l:'Estado',type:'select',opts:ESTADOS,req:1,tag:1},
    {k:'motivo',l:'Motivo',type:'textarea',long:1},
    {k:'id_mascota',l:'Mascota',fk:'mascota',req:1},{k:'id_servicio',l:'Servicio',fk:'servicio',req:1}]}
};

const $ = id => document.getElementById(id);
const data = {}; let cur = 'citas'; let editing = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, err){ const t=$('toast'); t.textContent=msg; t.className=err?'err':''; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none',3800); }

function cell(r, f){
  const v = r[f.k];
  if (v === null || v === undefined || v === '') return '<span style="color:var(--mute)">—</span>';
  if (f.fk){ const x = data[f.fk].find(o => o[E[f.fk].pk] === v); return esc(x ? E[f.fk].label(x) : v); }
  if (f.money) return 'S/ ' + Number(v).toLocaleString('es-PE',{minimumFractionDigits:2});
  if (f.kg) return Number(v).toLocaleString('es-PE') + ' kg';
  if (f.k === 'duracion_min') return esc(v) + ' min';
  if (f.type === 'date') return esc(String(v).split('-').reverse().join('/'));
  if (f.type === 'time') return esc(String(v).slice(0,5));
  if (f.tag) return `<span class="tag ${esc(v)}">${esc(v)}</span>`;
  return esc(v);
}
const plain = (r, f) => { const h = document.createElement('div'); h.innerHTML = cell(r,f); return h.textContent; };

function render(){
  const cfg = E[cur];
  $('title').textContent = cfg.title;
  $('add').textContent = cfg.nw + ' ' + cfg.one;
  $('nav').innerHTML = Object.keys(E).map(k => `<button class="nav ${k===cur?'on':''}" data-k="${k}">${E[k].title}<span>${(data[k]||[]).length}</span></button>`).join('');
  $('thead').innerHTML = '<tr><th>ID</th>' + cfg.fields.filter(f=>!f.long).map(f=>`<th>${f.l}</th>`).join('') + '<th></th></tr>';
  const q = $('q').value.trim().toLowerCase();
  const rows = (data[cur]||[]).filter(r => !q || cfg.fields.some(f => plain(r,f).toLowerCase().includes(q)));
  $('tbody').innerHTML = rows.map(r => `<tr><td>${r[cfg.pk]}</td>` + cfg.fields.filter(f=>!f.long).map(f=>`<td>${cell(r,f)}</td>`).join('') +
    `<td class="act"><button class="b g" data-e="${r[cfg.pk]}">Editar</button><button class="b g d" data-d="${r[cfg.pk]}">Eliminar</button></td></tr>`).join('');
  $('empty').hidden = rows.length > 0;
  $('empty').textContent = q ? 'Ningún resultado para esa búsqueda.' : `Aún no hay ${cfg.title.toLowerCase()}. Usa “${cfg.nw} ${cfg.one}” para agregar el primero.`;
}

async function loadAll(){
  const res = await Promise.all(Object.keys(E).map(k => sb.from(k).select('*').order(E[k].pk)));
  Object.keys(E).forEach((k,i) => {
    if (res[i].error) toast(`No se pudo leer “${k}”: ${res[i].error.message}`, true);
    data[k] = res[i].data || [];
  });
  render();
}

function openForm(id){
  const cfg = E[cur]; editing = id;
  const r = id != null ? data[cur].find(x => x[cfg.pk] === id) : {};
  $('frm').innerHTML = `<h2>${id!=null?'Editar':cfg.nw} ${cfg.one}</h2>` + cfg.fields.map(f => {
    let v = r[f.k] ?? (f.today ? new Date().toLocaleDateString('en-CA') : '');
    if (f.type === 'time' && v) v = String(v).slice(0,5);
    const a = `id="f_${f.k}" name="${f.k}" ${f.req?'required':''}`;
    let inp;
    if (f.fk) inp = `<select ${a}><option value="">— Seleccionar —</option>${data[f.fk].map(o=>`<option value="${o[E[f.fk].pk]}" ${o[E[f.fk].pk]===v?'selected':''}>${esc(E[f.fk].label(o))}</option>`).join('')}</select>`;
    else if (f.type==='select') inp = `<select ${a}><option value="">— Seleccionar —</option>${f.opts.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`;
    else if (f.type==='textarea') inp = `<textarea ${a} rows="3">${esc(v)}</textarea>`;
    else inp = `<input ${a} type="${f.type||'text'}" ${f.step?`step="${f.step}" min="${f.min ?? 0}"`:''} value="${esc(v)}">`;
    return `<label for="f_${f.k}">${f.l}${f.req?' *':''}</label>${inp}`;
  }).join('') + `<div class="row"><button type="button" class="b g" id="cancel">Cancelar</button><button class="b" type="submit">Guardar cambios</button></div>`;
  $('dlg').showModal();
}

function friendly(error){
  if (error.code === '23505') return cur === 'citas' ? 'Ya hay una cita activa en esa fecha y hora.' : 'Ya existe un registro con esos datos.';
  return error.message;
}

$('frm').addEventListener('submit', async e => {
  e.preventDefault();
  const cfg = E[cur], body = {};
  cfg.fields.forEach(f => {
    let v = $('f_'+f.k).value.trim();
    if (v === '') v = null;
    else if (f.type==='number') v = Number(v);
    else if (f.fk) v = Number(v);
    body[f.k] = v;
  });
  const q = editing != null ? sb.from(cur).update(body).eq(cfg.pk, editing) : sb.from(cur).insert(body);
  const { error } = await q;
  if (error) return toast('No se pudo guardar: ' + friendly(error), true);
  $('dlg').close(); toast(editing != null ? 'Cambios guardados' : 'Registro creado'); loadAll();
});

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-k],[data-e],[data-d],#cancel');
  if (!t) return;
  if (t.dataset.k){ cur = t.dataset.k; $('q').value=''; render(); }
  else if (t.dataset.e) openForm(Number(t.dataset.e));
  else if (t.dataset.d){
    const cfg = E[cur];
    if (!confirm(`¿Eliminar ${cfg.nw === 'Nueva' ? 'esta' : 'este'} ${cfg.one}? Esta acción no se puede deshacer.`)) return;
    const { error } = await sb.from(cur).delete().eq(cfg.pk, Number(t.dataset.d));
    if (error) return toast('No se pudo eliminar (¿tiene registros relacionados?): ' + error.message, true);
    toast('Registro eliminado'); loadAll();
  }
  else if (t.id === 'cancel') $('dlg').close();
});
$('add').onclick = () => openForm(null);
$('q').oninput = render;

if (SUPABASE_URL.includes('TU-PROYECTO')) { $('setup').style.display='block'; Object.keys(E).forEach(k=>data[k]=[]); render(); }
else loadAll();
