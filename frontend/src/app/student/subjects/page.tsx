'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Subject {
  id: string;
  name: string;
  order_index: number;
}

export default function StudentSubjectsPage() {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/student/subjects`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [token]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-900">Materias de mi curso</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((s, i) => (
          <Link
            key={s.id}
            href={`/student/subjects/${s.id}`}
            className="block p-6 bg-white rounded-xl border border-neutral-200 hover:border-red-600 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center font-bold text-lg shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 group-hover:text-red-600 transition-colors">{s.name}</h3>
                <p className="text-sm text-neutral-500 mt-1">Ver contenido y material</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {subjects.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-neutral-500">
          No hay materias disponibles en tu curso.
        </div>
      )}
    </div>
  );
}
