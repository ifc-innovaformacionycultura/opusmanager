// Gestor: Configuración de Email — estado Resend + panel de prueba
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIPOS_PRUEBA = [
  { value: 'prueba', label: 'Email de prueba general' },
  { value: 'nueva_convocatoria', label: 'Nueva convocatoria' },
  { value: 'recordatorio', label: 'Recordatorio de respuesta' },
  { value: 'aviso_ensayo', label: 'Aviso de ensayo' },
  { value: 'confirmacion_cobro', label: 'Confirmación de pago' }
];

const ConfiguracionEmail = () => {
  const { api } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Test panel
  const [destinatario, setDestinatario] = useState('');
  const [tipo, setTipo] = useState('prueba');
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const r = await api.get('/api/gestor/emails/status');
      setStatus(r.data);
    } catch (err) {
      setStatus({ conectado: false, mensaje: err.response?.data?.detail || err.message });
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const loadPreview = useCallback(async (t) => {
    try {
      const r = await api.get(`/api/gestor/emails/preview?tipo=${t}`);
      setPreview(r.data);
    } catch { setPreview(null); }
  }, [api]);

  useEffect(() => { loadPreview(tipo); }, [tipo, loadPreview]);

  const verificar = async () => {
    setChecking(true);
    await loadStatus();
    setChecking(false);
  };

  const enviarPrueba = async (e) => {
    e.preventDefault();
    if (!destinatario.trim()) return;
    setSending(true); setResult(null);
    try {
      const r = await api.post('/api/gestor/emails/test', { destinatario, tipo });
      setResult(r.data);
    } catch (err) {
      setResult({ sent: false, reason: err.response?.data?.detail || err.message });
    } finally { setSending(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="config-email-page">
      <header>
        <h1 className="font-cabinet text-3xl font-bold text-slate-900">Configuración de email</h1>
        <p className="font-ibm text-slate-600 mt-1">Estado de Resend y envío de pruebas.</p>
      </header>

      {/* Indicador de estado */}
      <section className="bg-white rounded-lg border border-slate-200 p-5" data-testid="resend-status">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
              loading ? 'bg-slate-100' : (status?.conectado ? 'bg-green-100' : 'bg-red-100')
            }`}>
              <span className="text-2xl">{loading ? '⏳' : (status?.conectado ? '✅' : '❌')}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {loading ? 'Comprobando...' : (status?.conectado ? 'Resend operativo' : 'Resend no disponible')}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{status?.mensaje || ''}</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-slate-500">Email remitente</p>
                  <p className="font-mono text-slate-800">{status?.sender || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Emails enviados este mes</p>
                  <p className="font-bold text-slate-900 text-lg">{status?.enviados_mes ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
          <button onClick={verificar} disabled={checking}
            data-testid="btn-verificar-resend"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-sm disabled:opacity-60">
            {checking ? 'Verificando...' : 'Verificar conexión'}
          </button>
        </div>
      </section>

      {/* Panel de prueba */}
      <section className="bg-white rounded-lg border border-slate-200 p-5" data-testid="panel-prueba">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Prueba de envío</h2>
        <form onSubmit={enviarPrueba} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de email</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              data-testid="select-tipo-prueba"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
              {TIPOS_PRUEBA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Destinatario</label>
            <input type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)}
              data-testid="input-destinatario"
              required
              placeholder="email@ejemplo.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={sending}
              data-testid="btn-enviar-prueba"
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium disabled:opacity-60">
              {sending ? 'Enviando...' : 'Enviar email de prueba'}
            </button>
          </div>
        </form>

        {result && (
          <div className={`mt-4 p-3 rounded-lg border ${result.sent ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
            data-testid="resultado-prueba">
            {result.sent ? (
              <>
                <p className="font-semibold">✅ Email enviado correctamente</p>
                {result.email_id && <p className="text-xs mt-1">ID Resend: <code className="font-mono">{result.email_id}</code></p>}
              </>
            ) : (
              <>
                <p className="font-semibold">❌ Error al enviar</p>
                <p className="text-xs mt-1">{result.reason}</p>
              </>
            )}
          </div>
        )}

        {/* Previsualización */}
        {preview && (
          <div className="mt-5 pt-5 border-t border-slate-200">
            <p className="text-xs uppercase text-slate-500 font-semibold mb-2">Previsualización</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-sm">
                <strong>Asunto:</strong> {preview.asunto}
              </div>
              <div className="p-4 bg-white" data-testid="email-preview-html"
                   dangerouslySetInnerHTML={{ __html: preview.html }}></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ConfiguracionEmail;
