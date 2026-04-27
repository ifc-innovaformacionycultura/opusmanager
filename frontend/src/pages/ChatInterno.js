// Chat interno entre gestores — TAREA 4.
// Soporta canal general, canales por evento abierto y DMs entre gestores.
// Polling cada 5s para mensajes del canal activo y 30s para badges de no leídos.

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const POLL_MS = 5000;
const POLL_BADGES_MS = 30000;

const fmtHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};
const fmtDia = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
const initials = (n) => {
  if (!n) return '??';
  const p = n.split(/[, ]+/).filter(Boolean);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
};
const bgFromName = (n) => {
  const palette = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500'];
  let h = 0;
  for (const c of (n || '')) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
};

const renderConMenciones = (texto) => {
  if (!texto) return null;
  const parts = texto.split(/(@[\w\.\-áéíóúñÁÉÍÓÚÑüÜ]+)/g);
  return parts.map((p, i) =>
    p.startsWith('@')
      ? <span key={i} className="bg-amber-200 text-amber-900 px-1 rounded font-medium">{p}</span>
      : <span key={i}>{p}</span>
  );
};

export default function ChatInterno() {
  // ===== Wrapper con pestañas Chat + Comentarios del equipo =====
  // El chat original se mantiene intacto en `ChatInternoView`.
  const [tab, setTab] = React.useState('chat');
  return (
    <div className="flex flex-col h-[calc(100vh-80px)]" data-testid="mensajes-page">
      <div className="border-b border-slate-200 bg-white px-4 flex items-center gap-1">
        <button onClick={() => setTab('chat')}
                data-testid="tab-chat"
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'chat' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
          💬 Chat
        </button>
        <button onClick={() => setTab('comentarios')}
                data-testid="tab-comentarios"
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'comentarios' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
          📋 Comentarios del equipo
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'chat' ? <ChatInternoView /> : <ComentariosEquipoTab />}
      </div>
    </div>
  );
}

function ChatInternoView() {
  const { api } = useAuth();
  const [canales, setCanales] = useState({ general: { id: 'general', nombre: 'General' }, eventos: [], gestores: [], mi_id: null });
  const [activo, setActivo] = useState('general');
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mentionSugg, setMentionSugg] = useState({ open: false, query: '', start: 0 });
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const loadCanales = useCallback(async () => {
    const r = await api.get('/api/gestor/mensajes/canales');
    setCanales(r.data || {});
  }, [api]);

  const loadMensajes = useCallback(async (canal) => {
    if (!canal) return;
    const r = await api.get(`/api/gestor/mensajes/${encodeURIComponent(canal)}`);
    setMensajes(r.data?.mensajes || []);
  }, [api]);

  const loadBadges = useCallback(async () => {
    try {
      const r = await api.get('/api/gestor/mensajes/no-leidos/lista');
      setUnread(r.data?.counts || {});
    } catch (e) { /* ignore */ }
  }, [api]);

  const marcarLeido = useCallback(async (canal) => {
    try { await api.put(`/api/gestor/mensajes/leido/${encodeURIComponent(canal)}`); } catch (e) { /* ignore */ }
  }, [api]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        await loadCanales();
        await loadMensajes('general');
        await loadBadges();
      } finally { setLoading(false); }
    })();
  }, [loadCanales, loadMensajes, loadBadges]);

  // Polling mensajes del canal activo
  useEffect(() => {
    if (!activo) return undefined;
    loadMensajes(activo);
    marcarLeido(activo);
    const id = setInterval(() => loadMensajes(activo), POLL_MS);
    return () => clearInterval(id);
  }, [activo, loadMensajes, marcarLeido]);

  // Polling badges de no leídos
  useEffect(() => {
    const id = setInterval(loadBadges, POLL_BADGES_MS);
    return () => clearInterval(id);
  }, [loadBadges]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [mensajes]);

  const seleccionarCanal = async (canal) => {
    setActivo(canal);
    setInput('');
    setMentionSugg({ open: false, query: '', start: 0 });
    setUnread(prev => ({ ...prev, [canal]: 0 }));
  };

  // Sugerencias @ — buscamos en la lista de gestores
  const gestoresMencionables = useMemo(() => {
    const list = canales.gestores || [];
    // Incluir también al usuario actual con su propio nombre
    if (canales.mi_id) {
      // Buscamos su nombre en la lista local
    }
    return list;
  }, [canales]);

  const onInputChange = (e) => {
    const v = e.target.value;
    setInput(v);
    const cursor = e.target.selectionStart;
    // Detectar @palabra previa al cursor
    const slice = v.slice(0, cursor);
    const match = slice.match(/@([\w\.\-áéíóúñÁÉÍÓÚÑüÜ]*)$/);
    if (match) {
      setMentionSugg({ open: true, query: match[1].toLowerCase(), start: cursor - match[0].length });
    } else {
      setMentionSugg({ open: false, query: '', start: 0 });
    }
  };

  const sugerencias = useMemo(() => {
    if (!mentionSugg.open) return [];
    const q = mentionSugg.query;
    return gestoresMencionables
      .filter(g => g.nombre.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionSugg, gestoresMencionables]);

  const insertarMencion = (gestor) => {
    const before = input.slice(0, mentionSugg.start);
    const cursor = inputRef.current?.selectionStart || input.length;
    const after = input.slice(cursor);
    // Usamos el primer apellido sin espacios para que el regex de menciones lo cace
    const handle = (gestor.nombre.split(',')[0] || gestor.nombre).trim().replace(/\s+/g, '_');
    const nuevo = `${before}@${handle} ${after}`;
    setInput(nuevo);
    setMentionSugg({ open: false, query: '', start: 0 });
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  // Extraer ids de gestores mencionados a partir del texto
  const extraerMenciones = (texto) => {
    const ids = new Set();
    const re = /@([\w\.\-áéíóúñÁÉÍÓÚÑüÜ_]+)/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      const handle = m[1].replace(/_/g, ' ').toLowerCase();
      const g = (canales.gestores || []).find(x => (x.nombre.split(',')[0] || x.nombre).trim().toLowerCase() === handle);
      if (g) ids.add(g.id);
    }
    return Array.from(ids);
  };

  const enviar = async () => {
    const texto = input.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      await api.post(`/api/gestor/mensajes/${encodeURIComponent(activo)}`, {
        contenido: texto,
        menciones: extraerMenciones(texto),
      });
      setInput('');
      await loadMensajes(activo);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setEnviando(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const totalNoLeidos = Object.values(unread).reduce((a, b) => a + b, 0);

  if (loading) return <div className="p-6 text-slate-500">Cargando chat…</div>;

  return (
    <div className="flex h-full bg-white" data-testid="chat-page">
      {/* Sidebar canales */}
      <aside className="w-72 border-r border-slate-200 flex flex-col bg-slate-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
          <h1 className="font-cabinet text-lg font-bold text-slate-900">💬 Mensajes</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{totalNoLeidos > 0 ? `${totalNoLeidos} sin leer` : 'Todo al día'}</p>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Canales</div>
          <ChannelItem
            id="general" label="# general" active={activo === 'general'} unread={unread['general']}
            onClick={() => seleccionarCanal('general')} testid="chan-general"
          />
          {(canales.eventos || []).map(c => (
            <ChannelItem
              key={c.id} id={c.id} label={`# ${c.nombre}`} active={activo === c.id} unread={unread[c.id]}
              onClick={() => seleccionarCanal(c.id)} testid={`chan-${c.evento_id}`}
            />
          ))}
          <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Mensajes directos</div>
          {(canales.gestores || []).map(g => (
            <ChannelItem
              key={g.id} id={g.canal} label={`@ ${g.nombre}`} active={activo === g.canal} unread={unread[g.canal]}
              onClick={() => seleccionarCanal(g.canal)} testid={`chan-dm-${g.id}`}
            />
          ))}
        </div>
      </aside>

      {/* Área principal */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900" data-testid="chan-title">
              {activo === 'general' && '# general'}
              {activo.startsWith('evento:') && `# ${(canales.eventos.find(c => c.id === activo) || {}).nombre || activo}`}
              {activo.startsWith('dm:') && `@ ${(canales.gestores.find(c => c.canal === activo) || {}).nombre || 'directo'}`}
            </h2>
            <p className="text-[11px] text-slate-500">
              {(canales.gestores || []).length + 1} gestores · polling cada {POLL_MS / 1000}s
            </p>
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50">
          {mensajes.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-12">
              Aún no hay mensajes. ¡Sé el primero en escribir!
            </div>
          )}
          {mensajes.map((m, i) => {
            const propio = m.gestor_id === canales.mi_id;
            const showHeader = i === 0 || mensajes[i - 1].gestor_id !== m.gestor_id;
            return (
              <div key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'} gap-2`} data-testid={`msg-${m.id}`}>
                {!propio && showHeader && (
                  <div className={`w-8 h-8 rounded-full ${bgFromName(m.gestor_nombre)} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0`}>
                    {initials(m.gestor_nombre)}
                  </div>
                )}
                {!propio && !showHeader && <div className="w-8 flex-shrink-0" />}
                <div className={`max-w-[70%] ${propio ? 'order-1' : ''}`}>
                  {showHeader && (
                    <div className={`text-[10px] mb-0.5 ${propio ? 'text-right text-slate-500' : 'text-slate-600 font-medium'}`}>
                      {!propio && <span>{m.gestor_nombre} · </span>}
                      <span className="text-slate-400">{fmtDia(m.created_at)} {fmtHora(m.created_at)}</span>
                    </div>
                  )}
                  <div className={`px-3 py-1.5 rounded-lg text-sm whitespace-pre-wrap break-words ${
                    propio ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
                  }`}>
                    {renderConMenciones(m.contenido)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 px-4 py-3 bg-white relative">
          {mentionSugg.open && sugerencias.length > 0 && (
            <div className="absolute bottom-full left-4 mb-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-48 overflow-y-auto z-10 min-w-[200px]" data-testid="mention-sugg">
              {sugerencias.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => insertarMencion(g)}
                  data-testid={`sugg-${g.id}`}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center gap-2"
                >
                  <span className={`w-5 h-5 rounded-full ${bgFromName(g.nombre)} text-white text-[9px] font-bold flex items-center justify-center`}>
                    {initials(g.nombre)}
                  </span>
                  <span className="text-slate-700">{g.nombre}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={Math.min(5, Math.max(1, input.split('\n').length))}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              placeholder={`Escribe en ${activo === 'general' ? '# general' : activo.startsWith('evento:') ? '# evento' : '@ DM'}… (Enter envía · Shift+Enter línea nueva · @ menciona)`}
              data-testid="chat-input"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!input.trim() || enviando}
              data-testid="chat-send"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-50"
            >{enviando ? '…' : 'Enviar'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const ChannelItem = ({ label, active, unread, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
      active ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    <span className="truncate">{label}</span>
    {unread > 0 && (
      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
        {unread > 99 ? '99+' : unread}
      </span>
    )}
  </button>
);


// ============================================================
// Pestaña "Comentarios del equipo" — TAREA 4B (CRUD + hilos)
// ============================================================
const ESTADO_LABEL = {
  pendiente:  { txt: '🟡 Pendiente',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  en_proceso: { txt: '🔵 En proceso', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  resuelto:   { txt: '✅ Resuelto',   cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

function ComentariosEquipoTab() {
  const { api } = useAuth();
  const [comentarios, setComentarios] = React.useState([]);
  const [gestores, setGestores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [filtros, setFiltros] = React.useState({ estado: '', autor_id: '', pagina: '', mencionado_id: '' });
  const [seleccionado, setSeleccionado] = React.useState(null);

  const cargarLista = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await api.get(`/api/gestor/comentarios-equipo${params.toString() ? '?' + params.toString() : ''}`);
      setComentarios(r.data?.comentarios || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  }, [api, filtros]);

  React.useEffect(() => { cargarLista(); }, [cargarLista]);
  React.useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/gestor/comentarios-equipo/_meta/gestores');
        setGestores(r.data?.gestores || []);
      } catch { /* noop */ }
    })();
  }, [api]);

  const nombreGestor = (id) => {
    const g = gestores.find(x => x.id === id);
    return g ? `${g.apellidos || ''}, ${g.nombre || ''}`.trim() : '?';
  };

  const fmtFecha = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="flex h-full bg-white" data-testid="ce-tab">
      <section className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                  data-testid="ce-filter-estado"
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Estado: todos</option>
            <option value="pendiente">🟡 Pendiente</option>
            <option value="en_proceso">🔵 En proceso</option>
            <option value="resuelto">✅ Resuelto</option>
          </select>
          <select value={filtros.autor_id} onChange={(e) => setFiltros({ ...filtros, autor_id: e.target.value })}
                  data-testid="ce-filter-autor"
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Autor: cualquiera</option>
            {gestores.map(g => <option key={g.id} value={g.id}>{g.apellidos}, {g.nombre}</option>)}
          </select>
          <select value={filtros.mencionado_id} onChange={(e) => setFiltros({ ...filtros, mencionado_id: e.target.value })}
                  data-testid="ce-filter-mencionado"
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="">Mencionado: cualquiera</option>
            {gestores.map(g => <option key={g.id} value={g.id}>{g.apellidos}, {g.nombre}</option>)}
          </select>
          <input type="text" placeholder="Página…"
                 value={filtros.pagina} onChange={(e) => setFiltros({ ...filtros, pagina: e.target.value })}
                 data-testid="ce-filter-pagina"
                 className="text-xs border border-slate-300 rounded px-2 py-1 bg-white w-40" />
          <span className="ml-auto text-xs text-slate-500">{comentarios.length} hilos</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-slate-500 text-sm">Cargando…</div>}
          {error && <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 m-3 rounded" data-testid="ce-list-error">{error}</div>}
          {!loading && !error && comentarios.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-sm">Sin comentarios.</div>
          )}
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {comentarios.map(c => (
                <tr key={c.id}
                    onClick={() => setSeleccionado(c.id)}
                    data-testid={`ce-row-${c.id}`}
                    className={`cursor-pointer hover:bg-slate-50 ${seleccionado === c.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2.5 align-top">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono rounded border ${ESTADO_LABEL[c.estado]?.cls || 'bg-slate-100 border-slate-300'}`}>
                      {ESTADO_LABEL[c.estado]?.txt || c.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{(c.contenido || '').slice(0, 60)}{(c.contenido || '').length > 60 ? '…' : ''}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">
                      {c.entidad_nombre ? `${c.seccion || c.pagina} → ${c.entidad_nombre}` : (c.seccion || c.pagina)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-600">
                    <div>{c.autor_nombre || '?'}</div>
                    {(c.menciones || []).length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {(c.menciones || []).slice(0, 3).map(m => (
                          <span key={m} className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">@{nombreGestor(m).split(',')[0]}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-center">{c.urgente && <span className="text-red-600">🔴</span>}</td>
                  <td className="px-3 py-2.5 align-top text-slate-500 whitespace-nowrap">
                    {fmtFecha(c.created_at)}
                    {c.respuestas_count > 0 && <div className="text-[10px] text-blue-600">💬 {c.respuestas_count}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {seleccionado && (
        <ComentarioHiloPanel
          comentarioId={seleccionado}
          gestores={gestores}
          api={api}
          onClose={() => setSeleccionado(null)}
          onChanged={cargarLista}
        />
      )}
    </div>
  );
}

function ComentarioHiloPanel({ comentarioId, gestores, api, onClose, onChanged }) {
  const [data, setData] = React.useState(null);
  const [respuesta, setRespuesta] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState(null);

  const cargar = React.useCallback(async () => {
    try {
      const r = await api.get(`/api/gestor/comentarios-equipo/${comentarioId}`);
      setData(r.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
  }, [api, comentarioId]);

  React.useEffect(() => { cargar(); setRespuesta(''); setError(null); }, [cargar]);

  const cambiarEstado = async (nuevo) => {
    try {
      await api.put(`/api/gestor/comentarios-equipo/${comentarioId}/estado`, { estado: nuevo });
      await cargar();
      onChanged && onChanged();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
  };

  const responder = async () => {
    if ((respuesta || '').trim().length < 3) return;
    setEnviando(true); setError(null);
    try {
      await api.post(`/api/gestor/comentarios-equipo/${comentarioId}/responder`, { contenido: respuesta.trim() });
      setRespuesta('');
      await cargar();
      onChanged && onChanged();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setEnviando(false); }
  };

  if (!data) {
    return (
      <aside className="w-[28rem] border-l border-slate-200 flex items-center justify-center text-slate-400">
        {error ? <span className="text-red-600 text-sm p-4">{error}</span> : 'Cargando…'}
      </aside>
    );
  }
  const c = data.comentario;
  const respuestas = data.respuestas || [];
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <aside className="w-[28rem] border-l border-slate-200 flex flex-col bg-white" data-testid="ce-panel">
      <header className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Hilo</h3>
          <p className="text-[11px] text-slate-500">{c.entidad_nombre ? `${c.seccion || c.pagina} → ${c.entidad_nombre}` : (c.seccion || c.pagina)}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span><strong className="text-slate-800">{c.autor_nombre}</strong> · {fmt(c.created_at)}</span>
            {c.urgente && <span className="text-red-600 font-bold">🔴 URGENTE</span>}
          </div>
          <div className="text-sm text-slate-800 whitespace-pre-wrap">{c.contenido}</div>
          {(c.menciones || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {c.menciones.map(m => {
                const g = gestores.find(x => x.id === m);
                return <span key={m} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">@{g ? `${g.apellidos}, ${g.nombre}` : 'gestor'}</span>;
              })}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-mono rounded border ${ESTADO_LABEL[c.estado]?.cls || 'bg-slate-100 border-slate-300'}`}>
              {ESTADO_LABEL[c.estado]?.txt}
            </span>
            {c.estado === 'resuelto' && c.resuelto_por && (
              <span className="text-[10px] text-slate-500">por {c.resuelto_por} · {fmt(c.resuelto_at)}</span>
            )}
          </div>
        </div>
        {respuestas.map(r => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3 ml-6">
            <div className="text-xs text-slate-500 mb-1">
              <strong className="text-slate-800">{r.autor_nombre}</strong> · {fmt(r.created_at)}
            </div>
            <div className="text-sm text-slate-800 whitespace-pre-wrap">{r.contenido}</div>
          </div>
        ))}
      </div>
      <footer className="border-t border-slate-200 p-3 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => cambiarEstado('en_proceso')}
                  data-testid="ce-btn-en-proceso"
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-300 rounded hover:bg-blue-100">
            🔵 En proceso
          </button>
          <button onClick={() => cambiarEstado('resuelto')}
                  data-testid="ce-btn-resuelto"
                  className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-100">
            ✅ Marcar como resuelto
          </button>
          {c.estado === 'resuelto' && (
            <button onClick={() => cambiarEstado('pendiente')}
                    className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-300 rounded hover:bg-yellow-100">
              ↩ Reabrir
            </button>
          )}
        </div>
        <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={3}
                  data-testid="ce-respuesta"
                  placeholder="Responder al hilo… (mín. 3 caracteres)"
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500" />
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
        <div className="mt-2 flex justify-end">
          <button onClick={responder} disabled={enviando}
                  data-testid="ce-enviar-respuesta"
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Responder'}
          </button>
        </div>
      </footer>
    </aside>
  );
}
