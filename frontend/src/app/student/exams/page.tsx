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
  attempted?: boolean;
  completed?: boolean;
  attemptId?: string;
  bestScore?: number;
  attemptsUsed?: number;
  maxAttempts?: number;
  canRetry?: boolean;
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

  const canTakeMore = (e: ExamItem) => !e.completed || (e.canRetry === true);
  const available = exams.filter((e) => canTakeMore(e));
  const completed = exams.filter((e) => e.completed && !e.canRetry);

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
            Rendir exámenes disponibles y revisar tus resultados.
          </p>
        </div>
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Disponibles para rendir</h3>
          <div className="grid gap-4">
            {available.map((ex) => (
              <Link
                key={ex.id}
                href={`/student/exams/${ex.id}`}
                className="group block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-red-500/50 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 group-hover:text-red-600 transition-colors">{ex.title}</h4>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {ex.question_count} preguntas
                        {ex.attemptsUsed != null && ex.maxAttempts != null && (
                          <span className="ml-2">· Intento {ex.attemptsUsed + 1} de {ex.maxAttempts}</span>
                        )}
                      </p>
                      {ex.bestScore != null && ex.attemptsUsed != null && ex.attemptsUsed > 0 && (
                        <p className="text-xs text-neutral-500 mt-0.5">Mejor nota: {ex.bestScore.toFixed(0)}%</p>
                      )}
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-800 group-hover:bg-red-200 transition-colors shrink-0">
                    {ex.attempted ? 'Rendir de nuevo' : 'Rendir examen'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Completados</h3>
          <div className="grid gap-4">
            {completed.map((ex) => (
              <Link
                key={ex.id}
                href={`/student/exams/${ex.id}/result`}
                className="group block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center shrink-0 transition-colors">
                      <svg className="w-6 h-6 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900">{ex.title}</h4>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        Mejor nota: {ex.bestScore != null ? `${ex.bestScore.toFixed(0)}%` : '—'} · Ver resultado
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
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
          <p className="text-sm text-neutral-500 mt-1">Tu curso aún no tiene exámenes publicados.</p>
        </div>
      )}
    </div>
  );
}
