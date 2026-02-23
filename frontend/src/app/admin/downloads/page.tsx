'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Cohort {
  id: string;
  name: string;
  code: string;
  course_id: string;
  courses?: { name: string };
}

export default function AdminDownloadsPage() {
  const { token } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status === 401) {
          triggerSessionExpired();
          return;
        }
        setCohorts(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0 && !cohortId) {
          setCohortId(data[0].id);
        }
      })
      .catch(() => setCohorts([]));
  }, [token]);

  const handleDownloadCurso = async () => {
    if (!token || !cohortId) {
      setError('Selecciona un curso (cohort)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/downloads/curso?cohortId=${encodeURIComponent(cohortId)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Error al generar el reporte');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `Reporte_curso_${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Error de conexión al descargar');
    } finally {
      setLoading(false);
    }
  };

  const selectedCohort = cohorts.find((c) => c.id === cohortId);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-neutral-100 mb-2">Descargas</h1>
      <p className="text-neutral-400 text-sm mb-6">
        Genera los archivos CSV requeridos por la Comisión Nacional de Transporte (ANEXO 2, ANEXO 4, Listado, Compra de permisos y Legalización de permisos) para el curso seleccionado. Cada archivo incluye el código del curso en su nombre (ej. Compra_Permisos_CursoTipoB_178.csv).
      </p>

      <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Curso (cohort)</label>
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 border border-neutral-600 text-neutral-100 px-3 py-2 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          >
            <option value="">Seleccionar curso</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleDownloadCurso}
            disabled={loading || !cohortId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:pointer-events-none text-neutral-900 font-medium px-4 py-3 transition"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                Generando ZIP...
              </>
            ) : (
              <>
                <DownloadIcon />
                Descargar reporte curso (ZIP: ANEXO 2, ANEXO 4, Listado, Compra de permisos, Legalización de permisos)
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 text-sm text-neutral-500 space-y-1">
        <p>El ZIP incluye tres archivos CSV listos para enviar o copiar a los formatos del estado:</p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li><strong>ANEXO_2_Permiso_Aprendizaje_[curso].csv</strong> — Verificación requisitos permiso de aprendizaje</li>
          <li><strong>ANEXO_4_Titulo_Conductor_[curso].csv</strong> — Verificación cumplimiento (calificaciones y asistencia)</li>
          <li><strong>Listado_Excel_[curso].csv</strong> — Listado escuela de conducción COLORADOS DRIVE</li>
          <li><strong>Compra_Permisos_[curso].csv</strong> — Compra de permisos (Ruc, Escuela, Identificación, Nombres, etc.)</li>
          <li><strong>Legalizacion_Permisos_[curso].csv</strong> — Legalización de permisos (formato ANT)</li>
        </ul>
        <p className="text-neutral-500 mt-1">[curso] = código del curso, ej. CursoTipoB_178 o CLD-IN-308</p>
        {selectedCohort && (
          <p className="pt-2 text-neutral-400">
            Curso seleccionado: <span className="text-neutral-300">{selectedCohort.name}</span> ({selectedCohort.code})
          </p>
        )}
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
