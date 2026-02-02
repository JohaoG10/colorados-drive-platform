'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExamResultPage() {
  const params = useParams();
  const { token } = useAuth();
  const examId = params.id as string;
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctCount?: number;
    total?: number;
    startedAt: string;
    finishedAt: string;
  } | null>(null);

  useEffect(() => {
    if (!token || !examId) return;
    fetch(`${API_URL}/api/student/exams/${examId}/my-attempt`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        if (data.attemptId) {
          return fetch(`${API_URL}/api/student/attempts/${data.attemptId}/result`, {
            headers: getAuthHeaders(token),
          }).then((r) => r.json());
        }
        return null;
      })
      .then((res) => res && setResult(res))
      .catch(console.error);
  }, [token, examId]);

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

      <div className="mt-6 text-center">
        <Link
          href="/student/exams"
          className="inline-block px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800"
        >
          Ver todos los exámenes
        </Link>
      </div>
    </div>
  );
}
