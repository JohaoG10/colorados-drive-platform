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
      <h2 className="text-lg font-semibold text-neutral-900">Mi progreso</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500 mb-1">Materias en tu curso</p>
          <p className="text-3xl font-bold text-neutral-900">{progress.subjectsTotal}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500 mb-1">Exámenes aprobados</p>
          <p className="text-3xl font-bold text-red-600">{progress.examsCompleted}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <p className="text-sm text-neutral-500 mb-1">Exámenes rendidos</p>
          <p className="text-3xl font-bold text-neutral-900">{progress.examResultsTotal}</p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <h3 className="px-6 py-4 font-medium text-neutral-900 border-b">Historial de exámenes</h3>
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-neutral-500">Examen</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-neutral-500">Nota</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-neutral-500">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-neutral-500">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-6 py-4 font-medium">{r.examTitle ?? r.exam_id}</td>
                  <td className="px-6 py-4">{r.score?.toFixed(1) ?? '-'}%</td>
                  <td className="px-6 py-4">
                    <span className={r.passed ? 'text-green-600' : 'text-red-600'}>
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
        <div className="bg-white rounded-xl border p-8 text-center text-neutral-500">
          Aún no has rendido ningún examen.
        </div>
      )}
    </div>
  );
}
