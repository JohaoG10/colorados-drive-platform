'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ExamItem {
  id: string;
  title: string;
  question_count: number;
  attemptId?: string;
  bestScore?: number;
  practiceAttemptsUsed?: number;
  practiceMaxAttempts?: number;
  definitiveAttemptsUsed?: number;
  definitiveMaxAttempts?: number;
  enabledForDefinitive?: boolean;
  canPractice?: boolean;
  canTakeDefinitive?: boolean;
  canRetry?: boolean;
  attempted?: boolean;
  completed?: boolean;
}

export default function StudentExamsPage() {
  const { token } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/student/exams`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then(setExams)
      .catch(() => setExams([]));
  }, [token]);

  const completed = exams.filter((e) => e.completed === true);
  const available = exams.filter((e) => e.canPractice || e.canTakeDefinitive);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px)`,
            }}
          />
        </div>
        <div className="relative z-10">
          <p className="text-red-100 text-sm font-medium mb-1">Evaluación</p>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Exámenes</h1>
          <p className="text-red-100 text-sm max-w-md">
            Mismo banco de preguntas para practicar y para el examen definitivo. Practica las veces que necesites; el día del examen se habilitará el definitivo para tu curso.
          </p>
        </div>
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Exámenes</h3>
          <div className="grid gap-4">
            {available.map((ex) => (
              <div
                key={ex.id}
                className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm"
              >
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-neutral-900">{ex.title}</h4>
                        <p className="text-sm text-neutral-500 mt-0.5">{ex.question_count} preguntas · Mismo banco para práctica y definitivo</p>
                        {ex.bestScore != null && (ex.practiceAttemptsUsed ?? 0) + (ex.definitiveAttemptsUsed ?? 0) > 0 && (
                          <p className="text-xs text-neutral-500 mt-1">Mejor nota: {ex.bestScore.toFixed(0)}%</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-neutral-600">
                          <span>Práctica: {ex.practiceAttemptsUsed ?? 0} de {ex.practiceMaxAttempts ?? 1} intentos</span>
                          {ex.enabledForDefinitive ? (
                            <span>· Definitivo: {ex.definitiveAttemptsUsed ?? 0} de {ex.definitiveMaxAttempts ?? 1} intentos</span>
                          ) : (
                            <span>· Definitivo: se habilita el día del examen</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.canPractice && (
                        <Link
                          href={`/student/exams/${ex.id}?mode=practice`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {(ex.practiceAttemptsUsed ?? 0) > 0 ? 'Seguir practicando' : 'Practicar'}
                        </Link>
                      )}
                      {ex.canTakeDefinitive && (
                        <Link
                          href={`/student/exams/${ex.id}?mode=definitive`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Rendir examen definitivo
                        </Link>
                      )}
                      {ex.completed && (
                        <Link
                          href={`/student/exams/${ex.id}/result`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver resultado
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Resultados (examen definitivo)</h3>
          <div className="grid gap-4">
            {completed.map((ex) => (
              <Link
                key={ex.id}
                href={`/student/exams/${ex.id}/result`}
                className="block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-neutral-900">{ex.title}</h4>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      Mejor nota: {ex.bestScore != null ? `${ex.bestScore.toFixed(0)}%` : '—'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-neutral-100 text-neutral-700">
                    Ver resultado
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {exams.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">No hay exámenes disponibles</p>
          <p className="text-sm text-neutral-500 mt-1">Tu curso aún no tiene exámenes configurados.</p>
        </div>
      )}
    </div>
  );
}
