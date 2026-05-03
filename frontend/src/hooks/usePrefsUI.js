// Hook genérico para sincronizar preferencias de UI con el servidor.
//
// useServerPref(key, defaultValue)
//   Devuelve [value, setValue, { ready, syncing }].
//
//   - Inicializa leyendo localStorage (fallback instantáneo).
//   - Al montar: llama GET /api/gestor/prefs-ui. Si el servidor tiene la clave,
//     hidrata con ese valor. Si NO la tiene pero hay un valor en localStorage,
//     hace un PUT inicial (migración transparente).
//   - setValue(v) hace optimistic update local + debounce 500ms + PUT server.
//   - Si el PUT falla, el valor local se mantiene (no se revierte); se muestra
//     un warning en consola.
//
// Pensado para preferencias pequeñas (arrays, booleans, objetos planos). No
// usar para datos grandes (>10KB por clave).
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const LS_PREFIX = "prefs_ui_";
const DEBOUNCE_MS = 500;

const readLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) {
      // Compatibilidad con claves existentes sin prefijo (migración)
      const legacy = localStorage.getItem(key);
      if (legacy !== null) return JSON.parse(legacy);
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeLS = (key, value) => {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* noop */ }
};

export function useServerPref(key, defaultValue) {
  const { api } = useAuth();
  const [value, setValueState] = useState(() => readLS(key, defaultValue));
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);

  // Carga inicial desde el servidor (una sola vez)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get("/api/gestor/prefs-ui");
        if (cancelled) return;
        const prefs = r.data?.prefs || {};
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
          // Hidrata con el valor del servidor
          setValueState(prefs[key]);
          writeLS(key, prefs[key]);
        } else {
          // No existía en servidor: si tenemos valor local (no default), migración transparente
          const localRaw = localStorage.getItem(LS_PREFIX + key);
          const legacyRaw = localStorage.getItem(key);
          if (localRaw !== null || legacyRaw !== null) {
            const localVal = readLS(key, defaultValue);
            if (JSON.stringify(localVal) !== JSON.stringify(defaultValue)) {
              try {
                await api.put("/api/gestor/prefs-ui", { prefs: { [key]: localVal } });
              } catch { /* silencioso */ }
            }
          }
        }
      } catch (e) {
        // Sin conexión → se queda con localStorage
        // eslint-disable-next-line no-console
        console.warn("[useServerPref] GET falló, usando localStorage:", e?.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback((next) => {
    setValueState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      writeLS(key, resolved);
      // Debounce PUT
      if (timerRef.current) clearTimeout(timerRef.current);
      setSyncing(true);
      timerRef.current = setTimeout(async () => {
        try {
          await api.put("/api/gestor/prefs-ui", { prefs: { [key]: resolved } });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[useServerPref] PUT falló (valor local conservado):", e?.message);
        } finally {
          setSyncing(false);
        }
      }, DEBOUNCE_MS);
      return resolved;
    });
  }, [api, key]);

  // Flush pendientes al desmontar
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return [value, setValue, { ready, syncing }];
}

export default useServerPref;
