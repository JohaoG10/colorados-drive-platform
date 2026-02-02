'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function StudentCoursePage() {
  const { token } = useAuth();
  const [course, setCourse] = useState<{ id: string; name: string; code: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/student/course`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then(setCourse)
      .catch(() => setCourse(null));
  }, [token]);

  if (!course) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <p className="text-neutral-500">No tienes un curso asignado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-8 road-stripes">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-red-600 flex items-center justify-center text-white text-2xl font-bold">
              {course.code.slice(0, 2)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">{course.name}</h2>
              <p className="text-neutral-500">Código: {course.code}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/student/subjects"
          className="block p-6 bg-white rounded-xl border border-neutral-200 hover:border-red-600 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-semibold text-neutral-900">Ver materias</h3>
          </div>
          <p className="text-sm text-neutral-500">Accede al contenido teórico de cada materia de tu curso.</p>
        </Link>

        <Link
          href="/student/exams"
          className="block p-6 bg-white rounded-xl border border-neutral-200 hover:border-red-600 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-neutral-900">Rendir exámenes</h3>
          </div>
          <p className="text-sm text-neutral-500">Evalúa tus conocimientos con los exámenes disponibles.</p>
        </Link>
      </div>
    </div>
  );
}
