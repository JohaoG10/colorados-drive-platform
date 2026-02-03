'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Progress {
  subjectsTotal: number;
  examsCompleted: number;
  examResultsTotal: number;
}

interface ExamItem {
  id: string;
  title: string;
  completed?: boolean;
}

interface ExamResult {
  examTitle?: string;
  score: number;
  passed: boolean;
  finished_at: string;
}

export default function StudentCoursePage() {
  const { token, user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [recentResults, setRecentResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/student/course`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/student/progress`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/student/exams`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/student/results`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
    ])
      .then(([courseData, progressData, examsData, resultsData]) => {
        setCourse(courseData?.id ? courseData : null);
        setProgress(progressData?.subjectsTotal !== undefined ? progressData : null);
        setExams(Array.isArray(examsData) ? examsData : []);
        setRecentResults(Array.isArray(resultsData) ? resultsData.slice(0, 3) : []);
      })
      .catch(() => {
        setCourse(null);
        setProgress(null);
        setExams([]);
        setRecentResults([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-neutral-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-neutral-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-neutral-600 font-medium">No tienes un curso asignado</p>
        <p className="text-sm text-neutral-500 mt-1">Contacta a tu administrador para que te asigne un curso.</p>
      </div>
    );
  }

  const pendingExams = exams.filter((e) => !e.completed).length;

  return (
    <div className="space-y-8">
      {/* Banner de bienvenida */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-8 text-white shadow-xl shadow-red-600/20">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px)`,
            }}
          />
        </div>
        <div className="relative z-10">
          <p className="text-red-100 text-sm font-medium mb-1">Bienvenido</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {user?.fullName?.split(' ')[0] || 'Estudiante'}
          </h1>
          <p className="text-red-100 max-w-md">
            Estás cursando <span className="font-semibold text-white">{course.name}</span>. Avanza con el material teórico y los exámenes para obtener tu licencia.
          </p>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
          <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{progress?.subjectsTotal ?? 0}</p>
              <p className="text-sm text-neutral-500">Materias</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{progress?.examsCompleted ?? 0}</p>
              <p className="text-sm text-neutral-500">Exámenes aprobados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{pendingExams}</p>
              <p className="text-sm text-neutral-500">Exámenes pendientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Continuar con tu formación</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/student/subjects"
            className="group block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-red-500/50 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 text-lg group-hover:text-red-600 transition-colors">Ver materias</h3>
                <p className="text-neutral-500 mt-1">Estudia el contenido teórico de cada materia de tu curso.</p>
                <span className="inline-flex items-center gap-1 mt-3 text-red-600 font-medium text-sm">
                  Ir a materias
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/student/exams"
            className="group block p-6 bg-white rounded-2xl border border-neutral-200 hover:border-red-500/50 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 text-lg group-hover:text-red-600 transition-colors">Rendir exámenes</h3>
                <p className="text-neutral-500 mt-1">Evalúa tus conocimientos con los exámenes disponibles.</p>
                <span className="inline-flex items-center gap-1 mt-3 text-red-600 font-medium text-sm">
                  Ir a exámenes
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Resultados recientes + Consejos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {recentResults.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-neutral-50/50">
              <h3 className="font-semibold text-neutral-900">Últimos exámenes</h3>
            </div>
            <ul className="divide-y divide-neutral-100">
              {recentResults.map((r, i) => (
                <li key={i} className="px-6 py-4 flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{r.examTitle ?? 'Examen'}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{r.score?.toFixed(0)}%</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.passed ? 'Aprobado' : 'Reprobado'}
                    </span>
                    <Link href="/student/exams" className="text-red-600 hover:text-red-700 text-sm font-medium">
                      Ver detalle
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`bg-amber-50 rounded-2xl border border-amber-200 p-6 ${recentResults.length > 0 ? '' : 'lg:col-span-3'}`}>
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Consejos para tu licencia
          </h3>
          <ul className="space-y-2 text-sm text-amber-900/90">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              Estudia el material teórico antes de cada examen.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              Puedes ver en qué te equivocaste después de cada examen.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              Revisa tu progreso en la sección correspondiente.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
