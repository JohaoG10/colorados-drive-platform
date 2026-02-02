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

  const available = exams.filter((e) => !e.completed);
  const completed = exams.filter((e) => e.completed);

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-neutral-900">Exámenes</h2>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-500 mb-3">Disponibles</h3>
          <div className="grid gap-4">
            {available.map((ex) => (
              <Link
                key={ex.id}
                href={`/student/exams/${ex.id}`}
                className="block p-6 bg-white rounded-xl border border-neutral-200 hover:border-red-600 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-900">{ex.title}</h4>
                    <p className="text-sm text-neutral-500 mt-1">{ex.question_count} preguntas</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Rendir examen
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-500 mb-3">Completados</h3>
          <div className="grid gap-4">
            {completed.map((ex) => (
              <Link
                key={ex.id}
                href={`/student/exams/${ex.id}/result`}
                className="block p-6 bg-white rounded-xl border border-neutral-200 hover:border-neutral-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-900">{ex.title}</h4>
                    <p className="text-sm text-neutral-500 mt-1">Examen completado</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-neutral-100 text-neutral-700">
                    Ver resultado
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {exams.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-neutral-500">
          No hay exámenes disponibles.
        </div>
      )}
    </div>
  );
}
