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
          <p className="text-red-100 text-sm font-medium mb-1">Formación teórica</p>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Materias de mi curso</h1>
          <p className="text-red-100 text-sm max-w-md">
            Estudia el contenido de cada materia antes de rendir los exámenes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((s, i) => (
          <Link
            key={s.id}
            href={`/student/subjects/${s.id}`}
            className="group block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-red-500/50 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center font-bold text-xl text-red-600 shrink-0 transition-colors">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 text-lg group-hover:text-red-600 transition-colors">{s.name}</h3>
                <p className="text-sm text-neutral-500 mt-1">Ver contenido y material</p>
                <span className="inline-flex items-center gap-1 mt-3 text-red-600 font-medium text-sm">
                  Entrar
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {subjects.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">No hay materias disponibles</p>
          <p className="text-sm text-neutral-500 mt-1">Tu curso aún no tiene materias asignadas.</p>
        </div>
      )}
    </div>
  );
}
