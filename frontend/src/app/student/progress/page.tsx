'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ExamResult {
  id: string;
  exam_id: string;
  examTitle?: string;
  score: number;
  passed: boolean;
  finished_at: string;
}

export default function StudentProgressPage() {
  const { token } = useAuth();
  const [progress, setProgress] = useState<{
    subjectsTotal: number;
    examsCompleted: number;
    examResultsTotal: number;
  } | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/student/progress`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then(setProgress);

    fetch(`${API_URL}/api/student/results`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then(setResults)
      .catch(() => setResults([]));
  }, [token]);

  if (!progress) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-neutral-500">Cargando progreso...</div>
      </div>
    );
  }

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
          <p className="text-red-100 text-sm font-medium mb-1">Seguimiento</p>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Mi progreso</h1>
          <p className="text-red-100 text-sm max-w-md">
            Resumen de materias, exámenes aprobados e historial.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-0.5">Materias en tu curso</p>
              <p className="text-2xl font-bold text-neutral-900">{progress.subjectsTotal}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-0.5">Exámenes aprobados</p>
              <p className="text-2xl font-bold text-red-600">{progress.examsCompleted}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-0.5">Exámenes rendidos</p>
              <p className="text-2xl font-bold text-neutral-900">{progress.examResultsTotal}</p>
            </div>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
            <h3 className="font-semibold text-neutral-900">Historial de exámenes</h3>
          </div>
          <table className="w-full">
            <thead className="bg-neutral-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Examen</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Nota</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900">{r.examTitle ?? r.exam_id}</td>
                  <td className="px-6 py-4">{r.score?.toFixed(1) ?? '-'}%</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.passed ? 'Aprobado' : 'Reprobado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">
                    {r.finished_at ? new Date(r.finished_at).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">Sin exámenes rendidos</p>
          <p className="text-sm text-neutral-500 mt-1">Aún no has rendido ningún examen.</p>
        </div>
      )}
    </div>
  );
}
