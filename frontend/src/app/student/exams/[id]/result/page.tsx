'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DetailAnswer {
  questionText: string;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string;
}

export default function ExamResultPage() {
  const params = useParams();
  const { token } = useAuth();
  const examId = params.id as string;
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctCount?: number;
    total?: number;
    startedAt: string;
    finishedAt: string;
  } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState<{ attempt: { score: number; passed: boolean }; answers: DetailAnswer[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!token || !examId) return;
    fetch(`${API_URL}/api/student/exams/${examId}/my-attempt`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        if (data.attemptId) {
          setAttemptId(data.attemptId);
          return fetch(`${API_URL}/api/student/attempts/${data.attemptId}/result`, {
            headers: getAuthHeaders(token),
          }).then((r) => r.json());
        }
        return null;
      })
      .then((res) => res && setResult(res))
      .catch(console.error);
  }, [token, examId]);

  useEffect(() => {
    if (!showDetail || !attemptId || !token) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetail(null);
    fetch(`${API_URL}/api/student/attempts/${attemptId}/detail`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => { if (ok && data) setDetail(data); else setDetail(null); })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [showDetail, attemptId, token]);

  if (!result) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-neutral-500">Cargando resultado...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/student/exams" className="text-neutral-500 hover:text-neutral-700 text-sm flex items-center gap-1 mb-6">
        ← Volver a exámenes
      </Link>

      <div className={`rounded-xl border-2 p-8 text-center ${
        result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-bold mb-4 ${
          result.passed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {result.score.toFixed(0)}%
        </div>
        <h2 className={`text-xl font-semibold ${result.passed ? 'text-green-800' : 'text-red-800'}`}>
          {result.passed ? '¡Aprobado!' : 'Reprobado'}
        </h2>
        {(result.correctCount != null || result.total != null) && (
          <p className="text-neutral-600 mt-2">
            {result.correctCount ?? 0} de {result.total ?? 0} respuestas correctas
          </p>
        )}
        <p className="text-sm text-neutral-500 mt-4">
          Realizado el {result.finishedAt ? new Date(result.finishedAt).toLocaleString() : '-'}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors"
          title="Ver en qué te equivocaste"
        >
          <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Ver en qué me equivoqué
        </button>
        <Link
          href="/student/exams"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800"
        >
          Ver todos los exámenes
        </Link>
      </div>

      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-neutral-900">Detalle de tus respuestas</h3>
              <button type="button" onClick={() => setShowDetail(false)} className="text-neutral-500 hover:text-neutral-700 p-1">✕</button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              {detailLoading ? (
                <p className="text-neutral-500 text-center py-8">Cargando...</p>
              ) : detail ? (
                <div className="space-y-3">
                  {detail.answers.map((a, i) => (
                    <div key={i} className={`rounded-lg border p-4 ${a.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                      <p className="font-medium text-neutral-900 text-sm mb-2">{i + 1}. {a.questionText}</p>
                      <p className="text-sm text-neutral-600"><span className="text-neutral-500">Tu respuesta:</span> {a.studentAnswer || '—'}</p>
                      {!a.isCorrect && (
                        <p className="text-sm text-green-700 mt-1"><span className="text-neutral-500">Respuesta correcta:</span> {a.correctAnswer}</p>
                      )}
                      <p className={`text-xs font-medium mt-1 ${a.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {a.isCorrect ? '✓ Correcta' : '✗ Incorrecta'}
                      </p>
                    </div>
                  ))}
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
