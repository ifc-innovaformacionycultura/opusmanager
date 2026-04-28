// Página de perfil personal del gestor: información básica + preferencias de notificaciones.
// Ruta: /admin/mi-perfil
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import NotifPreferenciasPanel from '../components/NotifPreferenciasPanel';

export default function MiPerfilGestor() {
  const { user, api } = useAuth();
  const rol = user?.role || user?.rol || '';
  const esAdmin = rol === 'admin' || rol === 'director_general';

  return (
    <div className="space-y-5 max-w-3xl" data-testid="mi-perfil-gestor">
      <div>
        <h1 className="font-cabinet text-2xl sm:text-3xl font-bold text-slate-900">Mi perfil</h1>
        <p className="text-sm text-slate-500 mt-1">Datos personales y preferencias de notificación.</p>
      </div>

      {/* Datos personales (lectura) */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <span className="text-xl">👤</span>
          <h3 className="text-sm font-semibold text-slate-900">Datos personales</h3>
        </div>
        <dl className="divide-y divide-slate-100">
          {[
            ['Nombre', user?.name || '—'],
            ['Email', user?.email || '—'],
            ['Rol', rol || '—'],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Para modificar nombre o rol, contacta con un administrador.
        </div>
      </section>

      {/* Preferencias de notificación */}
      <NotifPreferenciasPanel
        clientOrToken={api}
        endpoint="/api/auth/me/notif-preferencias"
        showVerificaciones={esAdmin}
      />
    </div>
  );
}
