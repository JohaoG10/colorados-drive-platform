'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState({ users: 0, courses: 0, exams: 0 });

  useEffect(() => {
    if (!token) return;
    const headers = getAuthHeaders(token);
    Promise.all([
      fetch(`${API_URL}/api/admin/users`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/courses`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/exams`, { headers }).then((r) => r.json()),
    ])
      .then(([users, courses, exams]) => {
        setStats({
          users: Array.isArray(users) ? users.length : 0,
          courses: Array.isArray(courses) ? courses.length : 0,
          exams: Array.isArray(exams) ? exams.length : 0,
        });
      })
      .catch(console.error);
  }, [token]);

  const cards = [
    {
      label: 'Usuarios',
      value: stats.users,
      href: '/admin/users',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'red',
    },
    {
      label: 'Cursos',
      value: stats.courses,
      href: '/admin/courses',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      color: 'neutral',
    },
    {
      label: 'Exámenes',
      value: stats.exams,
      href: '/admin/exams',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      color: 'neutral',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(239, 68, 68, 0.3) 40px, rgba(239, 68, 68, 0.3) 41px)`,
            }}
          />
        </div>
        <div className="relative z-10">
          <p className="text-neutral-400 text-sm font-medium mb-1">Panel de administración</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Resumen</h1>
          <p className="text-neutral-400 max-w-md">
            Gestiona usuarios, cursos, materias y exámenes desde aquí.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group block bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-lg hover:border-red-500/30 transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                c.color === 'red' ? 'bg-red-50 text-red-600 group-hover:bg-red-100' : 'bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200'
              }`}>
                {c.icon}
              </div>
              <div>
                <p className="text-sm text-neutral-500 mb-0.5">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color === 'red' ? 'text-red-600' : 'text-neutral-900'}`}>
                  {c.value}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Ir
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="font-semibold text-neutral-900 mb-4">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md shadow-red-600/20 hover:shadow-red-600/30 transition-all duration-200"
          >
            Crear usuario
          </Link>
          <Link
            href="/admin/courses"
            className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200"
          >
            Gestionar materias
          </Link>
          <Link
            href="/admin/exams"
            className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200"
          >
            Crear examen
          </Link>
          <Link
            href="/admin/promotions"
            className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200"
          >
            Reportes por curso
          </Link>
        </div>
      </div>
    </div>
  );
}
