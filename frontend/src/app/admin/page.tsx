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
    { label: 'Usuarios', value: stats.users, color: 'red' },
    { label: 'Cursos', value: stats.courses, color: 'neutral' },
    { label: 'Exámenes', value: stats.exams, color: 'neutral' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm"
          >
            <p className="text-sm text-neutral-500 mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color === 'red' ? 'text-red-600' : 'text-neutral-900'}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="font-semibold text-neutral-900 mb-4">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Crear usuario
          </Link>
          <Link
            href="/admin/courses"
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors"
          >
            Gestionar materias
          </Link>
          <Link
            href="/admin/exams"
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors"
          >
            Crear examen
          </Link>
        </div>
      </div>
    </div>
  );
}
