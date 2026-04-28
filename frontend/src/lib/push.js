// Helper Web Push — suscribir/desuscribir el navegador y registrar en backend.
//
// Uso:
//   import { ensurePushSubscription, isPushSupported } from '../lib/push';
//   await ensurePushSubscription(api);  // tras login
//
// El módulo es completamente best-effort: no rompe nunca al caller.

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

const subToJSON = (sub) => {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent || '',
  };
};

let _publicKeyCache = null;
const fetchPublicKey = async (clientOrToken) => {
  if (_publicKeyCache) return _publicKeyCache;
  const data = await _get(clientOrToken, '/api/push/vapid-public');
  _publicKeyCache = data?.public_key || null;
  return _publicKeyCache;
};

// Acepta cliente axios o token Bearer string. Devuelve { data } compatible.
const _post = async (clientOrToken, path, body) => {
  if (!clientOrToken) return null;
  if (typeof clientOrToken === 'string') {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clientOrToken}` },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(`POST ${path} ${r.status}`);
    return r.json();
  }
  const resp = await clientOrToken.post(path, body);
  return resp.data;
};
const _get = async (clientOrToken, path) => {
  if (!clientOrToken) return null;
  if (typeof clientOrToken === 'string') {
    const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}${path}`, {
      headers: { Authorization: `Bearer ${clientOrToken}` },
    });
    if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
    return r.json();
  }
  const resp = await clientOrToken.get(path);
  return resp.data;
};

/** Suscribe el navegador (si hay permiso) y persiste en backend. Devuelve true si OK.
 * @param clientOrToken axios-like instance OR string Bearer token. */
export const ensurePushSubscription = async (clientOrToken) => {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const pubKey = await fetchPublicKey(clientOrToken);
      if (!pubKey) return false;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey),
      });
    }
    await _post(clientOrToken, '/api/push/suscribir', subToJSON(sub));
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Push subscribe failed:', e);
    return false;
  }
};

/** Pide permiso al usuario y, si lo concede, suscribe. Devuelve estado final ('granted'|'denied'|'default'). */
export const requestPushPermission = async (clientOrToken) => {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'granted') {
    await ensurePushSubscription(clientOrToken);
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    await ensurePushSubscription(clientOrToken);
  }
  return perm;
};

/** Desuscribe el navegador y elimina la suscripción del backend (al cerrar sesión). */
export const unsubscribePush = async (clientOrToken) => {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const json = subToJSON(sub);
    await sub.unsubscribe();
    try { await _post(clientOrToken, '/api/push/desuscribir', json); } catch {}
  } catch {/* noop */}
};
