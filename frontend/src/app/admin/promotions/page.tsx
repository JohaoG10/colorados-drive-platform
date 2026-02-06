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
  courses?: { name: string; code: string };
}

export default function ReportesPorCursoPage() {
  const { token } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [report, setReport] = useState<{
    cohort: { name: string; code: string; courseName?: string };
    students: { fullName: string; email: string; examResults: { attemptId: string; examTitle: string; score: number; passed: boolean }[]; totalTimeSeconds: number }[];
  } | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [detailAttemptId, setDetailAttemptId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    attempt: { score: number; passed: boolean };
    user: { email: string; fullName: string };
    answers: { questionText: string; isCorrect: boolean; studentAnswer: string; correctAnswer: string }[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteWithUsersModal, setDeleteWithUsersModal] = useState<Cohort | null>(null);
  const [deleteWithUsersLoading, setDeleteWithUsersLoading] = useState(false);

  const load = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ status: r.status, data: d }))),
      fetch(`${API_URL}/api/admin/courses`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
    ])
      .then(([cohortsRes, coursesData]) => {
        if (cohortsRes.status === 401) { triggerSessionExpired(); return; }
        setCohorts(Array.isArray(cohortsRes.data) ? cohortsRes.data : []);
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      })
      .catch(() => { setCohorts([]); setCourses([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    if (!selectedCohort || !token) {
      setReport(null);
      setReportError('');
      return;
    }
    setReportLoading(true);
    setReportError('');
    setReport(null);
    fetch(`${API_URL}/api/admin/cohorts/${selectedCohort.id}/report`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, status, data }) => {
        if (status === 401) { triggerSessionExpired(); return; }
        if (!ok) {
          setReportError(data?.error || 'Error al cargar el reporte');
          setReport(null);
          return;
        }
        setReport(data);
        setReportError('');
      })
      .catch(() => {
        setReportError('Error de conexión');
        setReport(null);
      })
      .finally(() => setReportLoading(false));
  }, [selectedCohort, token]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const deleteCohortWithUsers = async () => {
    const c = deleteWithUsersModal;
    if (!c || !token) return;
    setDeleteWithUsersLoading(true);
    setReportError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/cohorts/${c.id}?deleteUsers=true`, { method: 'DELETE', headers: getAuthHeaders(token) });
      if (res.status === 401) { triggerSessionExpired(); setDeleteWithUsersModal(null); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error');
      if (selectedCohort?.id === c.id) setSelectedCohort(null);
      setReport(null);
      setDeleteWithUsersModal(null);
      load();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleteWithUsersLoading(false);
    }
  };


  useEffect(() => {
    if (!detailAttemptId || !token) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetail(null);
    fetch(`${API_URL}/api/admin/attempts/${detailAttemptId}/detail`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => { if (ok && data) setDetail(data); else setDetail(null); })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [detailAttemptId, token]);

  const downloadExcel = () => {
    if (!report) return;
    const courseLabel = `${report.cohort?.courseName || 'Curso'} Nro ${report.cohort?.name || ''}`;
    const headers = ['Estudiante', 'Email', 'Tiempo en plataforma', 'Exámenes (detalle)'];
    const rows = (report.students || []).map((s) => {
      const timeStr = formatTime(s.totalTimeSeconds ?? 0);
      const examsStr = (s.examResults || [])
        .map((e) => `${e.examTitle}: ${e.score?.toFixed(0)}% ${e.passed ? 'Aprobado' : 'No aprobado'}`)
        .join('; ') || '-';
      return [s.fullName || s.email, s.email, timeStr, examsStr];
    });
    const escape = (v: string) => (v.includes(';') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${courseLabel.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredCohorts = searchLower
    ? cohorts.filter((c) => {
        const label = `${c.courses?.name || 'Curso'} Nro ${c.name} ${c.code}`.toLowerCase();
        return label.includes(searchLower);
      })
    : cohorts;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-6 text-white shadow-xl">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Reportes por curso</h2>
          <p className="text-neutral-400 text-sm">
            Selecciona un curso para ver el reporte de estudiantes y sus exámenes. Crea cursos en Cursos y materias.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
            <h3 className="font-semibold text-neutral-900 mb-3">Buscar curso</h3>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ej: Tipo B, 200, Mecánica..."
              className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
            />
          </div>
          {loading ? (
            <div className="p-8 text-center text-neutral-500">Cargando...</div>
          ) : cohorts.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              Aún no hay cursos con número. Ve a <strong>Cursos y materias</strong> para crear el tipo de curso (Tipo A o B) y luego crear números de curso.
            </div>
          ) : filteredCohorts.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              No hay cursos que coincidan con &quot;{searchQuery.trim()}&quot;. Prueba con otro término.
            </div>
          ) : (
            <ul className="divide-y max-h-[400px] overflow-auto">
              {filteredCohorts.map((c) => (
                <li
                  key={c.id}
                  className={`px-6 py-4 flex justify-between items-center gap-3 cursor-pointer hover:bg-neutral-50 ${selectedCohort?.id === c.id ? 'bg-red-50' : ''}`}
                  onClick={() => setSelectedCohort(selectedCohort?.id === c.id ? null : c)}
                >
                  <p className="font-medium min-w-0">{c.courses?.name || 'Curso'} Nro {c.name}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteWithUsersModal(c); }}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    title="Eliminar este curso y todos sus usuarios (descarga el CSV antes)"
                  >
                    Eliminar curso y usuarios
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && cohorts.length > 0 && filteredCohorts.length > 0 && (
            <p className="px-6 py-2 text-xs text-neutral-500 border-t">
              {filteredCohorts.length} de {cohorts.length} curso{cohorts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <h3 className="px-6 py-4 font-semibold text-neutral-900 border-b border-neutral-100 bg-neutral-50/50">Reporte del curso</h3>
          {!selectedCohort ? (
            <div className="p-8 text-center text-neutral-500">Selecciona un curso</div>
          ) : reportLoading ? (
            <div className="p-8 text-center text-neutral-500">Cargando reporte...</div>
          ) : reportError ? (
            <div className="p-6 text-red-600">{reportError}</div>
          ) : report ? (
            <div className="p-6 overflow-auto overflow-x-auto max-h-[500px]">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <p className="font-medium text-neutral-900">{report.cohort?.courseName || 'Curso'} Nro {report.cohort?.name || ''}</p>
                <button
                  type="button"
                  onClick={downloadExcel}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 shadow-md transition-all"
                >
                  Descargar Excel (CSV)
                </button>
              </div>
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Estudiante</th>
                    <th className="text-left py-2 font-medium">Tiempo</th>
                    <th className="text-left py-2 font-medium">Exámenes</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.students || []).map((s) => (
                    <tr key={s.email} className="border-b">
                      <td className="py-2">
                        <p className="font-medium">{s.fullName || s.email}</p>
                        <p className="text-neutral-500 text-xs">{s.email}</p>
                      </td>
                      <td className="py-2">{formatTime(s.totalTimeSeconds ?? 0)}</td>
                      <td className="py-2">
                        {s.examResults?.length ? (
                          <ul className="space-y-1">
                            {s.examResults.map((e, i) => (
                              <li key={i} className={`flex items-center gap-2 ${e.passed ? 'text-green-600' : 'text-red-600'}`}>
                                <span>{e.examTitle}: {e.score?.toFixed(0)}% {e.passed ? '✓' : '✗'}</span>
                                <button
                                  type="button"
                                  onClick={() => setDetailAttemptId(e.attemptId)}
                                  className="inline-flex items-center gap-1 text-neutral-600 hover:text-red-600 p-1 rounded font-medium text-xs"
                                  title="Ver respuestas de este examen"
                                >
                                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  Ver
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {deleteWithUsersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deleteWithUsersLoading && setDeleteWithUsersModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-neutral-900 mb-2">Eliminar curso y todos los usuarios</h3>
            <p className="text-neutral-600 text-sm mb-4">
              Se eliminará <strong>{deleteWithUsersModal.courses?.name || 'Curso'} Nro {deleteWithUsersModal.name}</strong> y todos los usuarios asignados
              {selectedCohort?.id === deleteWithUsersModal.id && report?.students != null ? ` (${report.students.length} estudiantes).` : '.'}
              {' '}Sus datos (exámenes, intentos, actividad) se borrarán. Asegúrate de haber descargado el reporte CSV. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteWithUsersModal(null)}
                disabled={deleteWithUsersLoading}
                className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteCohortWithUsers}
                disabled={deleteWithUsersLoading}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteWithUsersLoading ? 'Eliminando...' : 'Sí, eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailAttemptId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailAttemptId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="font-semibold text-neutral-900">Respuestas del examen</h3>
              <button type="button" onClick={() => setDetailAttemptId(null)} className="text-neutral-500 hover:text-neutral-700 p-1">✕</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {detailLoading ? (
                <p className="text-neutral-500 text-center py-8">Cargando...</p>
              ) : detail ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    <span className="font-medium">{detail.user.fullName || detail.user.email}</span>
                    {' · '}
                    {detail.attempt.score?.toFixed(1)}% {detail.attempt.passed ? '(Aprobado)' : '(Reprobado)'}
                  </p>
                  <div className="space-y-3">
                    {detail.answers.map((a, i) => (
                      <div key={i} className={`rounded-lg border p-4 ${a.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                        <p className="font-medium text-neutral-900 text-sm mb-2">{i + 1}. {a.questionText}</p>
                        <p className="text-sm text-neutral-600"><span className="text-neutral-500">Respondió:</span> {a.studentAnswer || '—'}</p>
                        {!a.isCorrect && (
                          <p className="text-sm text-green-700 mt-1"><span className="text-neutral-500">Correcto:</span> {a.correctAnswer}</p>
                        )}
                        <p className={`text-xs font-medium mt-1 ${a.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {a.isCorrect ? '✓ Correcta' : '✗ Incorrecta'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-8">No se pudo cargar el detalle.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
