'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ResultRow {
  id: string;
  user_id: string;
  score: number;
  passed: boolean;
  started_at: string;
  finished_at: string;
  email?: string;
  fullName?: string;
}

export default function AdminExamResultsPage() {
  const params = useParams();
  const examId = params?.id as string;
  const { token } = useAuth();
  const [examTitle, setExamTitle] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [detailAttemptId, setDetailAttemptId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ attempt: { score: number; passed: boolean }; user: { email: string; fullName: string }; answers: { questionText: string; isCorrect: boolean; studentAnswer: string; correctAnswer: string }[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!token || !examId) return;
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`${API_URL}/api/admin/exams/${examId}`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d }))),
      fetch(`${API_URL}/api/admin/exams/${examId}/results`, { headers: getAuthHeaders(token) }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d }))),
    ])
      .then(([examRes, resultsRes]) => {
        if (examRes.ok && examRes.data?.title) setExamTitle(examRes.data.title);
        else if (!examRes.ok && (examRes.data as { error?: string })?.error) setError((examRes.data as { error: string }).error);
        if (resultsRes.ok && Array.isArray(resultsRes.data)) setResults(resultsRes.data);
        else if (!resultsRes.ok && resultsRes.data?.error) setError(resultsRes.data.error);
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [token, examId]);

  const grantExtraAttempt = async (userId: string) => {
    if (!token || !examId) return;
    setGrantingUserId(userId);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/exams/${examId}/grant-attempt`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Error');
      setMessage('Intento extra otorgado correctamente');
      setGrantingUserId(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al otorgar');
      setGrantingUserId(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });

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

  if (!examId) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">ID de examen no válido.</p>
        <Link href="/admin/exams" className="text-red-600 hover:underline mt-2 inline-block">Volver a exámenes</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/exams" className="text-neutral-600 hover:text-neutral-900 text-sm font-medium flex items-center gap-1">
          ← Exámenes
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 p-6 text-white shadow-xl">
        <h1 className="text-xl font-bold mb-1">Resultados del examen</h1>
        <p className="text-neutral-400 text-sm">{examTitle || 'Cargando...'}</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${message.includes('correctamente') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-neutral-500">Cargando resultados...</div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <p className="text-neutral-600 font-medium">Aún no hay intentos registrados</p>
          <p className="text-sm text-neutral-500 mt-1">Los resultados aparecerán cuando los estudiantes rindan el examen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">Estudiante</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">Nota</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-neutral-900">{r.fullName || r.email || '—'}</p>
                      {r.fullName && r.email && <p className="text-sm text-neutral-500">{r.email}</p>}
                    </td>
                    <td className="px-6 py-4 font-medium text-neutral-900">{typeof r.score === 'number' ? `${r.score.toFixed(1)}%` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {r.passed ? 'Aprobado' : 'Reprobado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{formatDate(r.finished_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDetailAttemptId(r.id)}
                          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Ver respuestas
                        </button>
                        <button
                          type="button"
                          onClick={() => grantExtraAttempt(r.user_id)}
                          disabled={grantingUserId !== null}
                          className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
                          title="Otorgar un intento extra (ej. supletorio)"
                        >
                          {grantingUserId === r.user_id ? '...' : 'Otorgar intento extra'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <p className="text-sm text-neutral-500">
        <strong>Ver respuestas</strong> muestra las respuestas del estudiante. <strong>Otorgar intento extra</strong> permite al estudiante rendir el examen una vez más (ej. supletorio).
      </p>
    </div>
  );
}
