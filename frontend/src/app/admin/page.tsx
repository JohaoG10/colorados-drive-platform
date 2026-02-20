'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  cohort_id: string | null;
  created_at: string;
  cohorts?: { name: string } | null;
  courses?: { name: string } | null;
}

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    students: 0,
    admins: 0,
    courses: 0,
    cohorts: 0,
    exams: 0,
  });
  const [studentsByCohort, setStudentsByCohort] = useState<{ label: string; count: number }[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    if (!token) return;
    const headers = getAuthHeaders(token);
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/admin/users`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/courses`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/cohorts`, { headers }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/exams`, { headers }).then((r) => r.json()),
    ])
      .then(([users, courses, cohorts, exams]) => {
        const userList = Array.isArray(users) ? users as UserRow[] : [];
        const students = userList.filter((u) => u.role === 'student');
        const admins = userList.filter((u) => u.role === 'admin');
        const cohortCounts = new Map<string, { label: string; count: number }>();
        students.forEach((u) => {
          if (u.cohort_id) {
            const label = u.cohorts?.name && u.courses?.name
              ? `${u.courses.name} Nro ${u.cohorts.name}`
              : u.cohort_id.slice(0, 8);
            const cur = cohortCounts.get(u.cohort_id) ?? { label, count: 0 };
            cur.count += 1;
            cohortCounts.set(u.cohort_id, cur);
          }
        });
        setStudentsByCohort(Array.from(cohortCounts.values()).sort((a, b) => b.count - a.count).slice(0, 8));
        setRecentUsers(
          userList
            .filter((u) => u.role === 'student')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
        );
        setStats({
          students: students.length,
          admins: admins.length,
          courses: Array.isArray(courses) ? courses.length : 0,
          cohorts: Array.isArray(cohorts) ? cohorts.length : 0,
          exams: Array.isArray(exams) ? exams.length : 0,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const maxBar = Math.max(1, ...studentsByCohort.map((c) => c.count));

  const quickLinks = [
    { href: '/admin/users', label: 'Crear usuario', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', primary: true },
    { href: '/admin/schedules', label: 'Horarios', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', primary: false },
    { href: '/admin/promotions', label: 'Reportes', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5a2 2 0 012 2v5.5a2 2 0 01-2 2z', primary: false },
    { href: '/admin/notifications', label: 'Avisos', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', primary: false },
    { href: '/admin/courses', label: 'Cursos y materias', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', primary: false },
    { href: '/admin/exams', label: 'Exámenes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', primary: false },
  ];

  return (
    <div className="space-y-8 pb-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-red-700 to-rose-800 p-8 sm:p-10 text-white shadow-2xl shadow-red-900/30">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.4),transparent)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="text-red-100 text-sm font-medium uppercase tracking-wider mb-2">Panel de administración</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bienvenido al resumen</h1>
            <p className="mt-2 text-red-100/90 max-w-lg text-sm sm:text-base">
              Aquí puedes ver el estado de la plataforma, acceder a reportes y gestionar usuarios, cursos y exámenes.
            </p>
          </div>
          {!loading && (
            <div className="flex gap-4 text-right shrink-0">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{stats.students}</p>
                <p className="text-red-200 text-xs sm:text-sm">Estudiantes</p>
              </div>
              <div className="pl-4 border-l border-white/30">
                <p className="text-2xl sm:text-3xl font-bold">{stats.cohorts}</p>
                <p className="text-red-200 text-xs sm:text-sm">Cursos activos</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link
          href="/admin/users"
          className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-red-50 group-hover:bg-red-100 transition-colors" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Estudiantes</p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold text-neutral-900">{loading ? '—' : stats.students}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
          </div>
          <span className="relative mt-3 inline-flex items-center text-sm font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver usuarios →</span>
        </Link>

        <Link
          href="/admin/users"
          className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-neutral-300 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-neutral-100 group-hover:bg-neutral-200 transition-colors" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Administradores</p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold text-neutral-900">{loading ? '—' : stats.admins}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-neutral-200 text-neutral-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
          </div>
          <span className="relative mt-3 inline-flex items-center text-sm font-medium text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver usuarios →</span>
        </Link>

        <Link
          href="/admin/courses"
          className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-amber-50 group-hover:bg-amber-100 transition-colors" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Tipos de curso</p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold text-neutral-900">{loading ? '—' : stats.courses}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
          </div>
          <span className="relative mt-3 inline-flex items-center text-sm font-medium text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">Cursos y materias →</span>
        </Link>

        <Link
          href="/admin/exams"
          className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-emerald-50 group-hover:bg-emerald-100 transition-colors" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Exámenes</p>
              <p className="mt-1 text-2xl sm:text-3xl font-bold text-neutral-900">{loading ? '—' : stats.exams}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
          </div>
          <span className="relative mt-3 inline-flex items-center text-sm font-medium text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">Gestionar exámenes →</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Gráfico estudiantes por curso */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">Estudiantes por curso</h2>
          <p className="text-sm text-neutral-500 mb-5">Distribución por número de curso</p>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-neutral-400 text-sm">Cargando...</div>
          ) : studentsByCohort.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-neutral-400 text-sm rounded-xl bg-neutral-50 border border-dashed border-neutral-200">
              Aún no hay estudiantes inscritos por curso.
            </div>
          ) : (
            <div className="space-y-4">
              {studentsByCohort.map((item, i) => (
                <div key={item.label + i} className="flex items-center gap-3">
                  <div className="w-32 sm:w-40 shrink-0 text-sm text-neutral-700 truncate" title={item.label}>
                    {item.label}
                  </div>
                  <div className="flex-1 min-w-0 h-8 rounded-lg bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(8, (item.count / maxBar) * 100)}%` }}
                    >
                      {item.count > 0 && (item.count / maxBar) > 0.25 && (
                        <span className="text-xs font-semibold text-white">{item.count}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-neutral-700">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos inscritos */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Últimos inscritos</h2>
            <Link href="/admin/users" className="text-sm font-medium text-red-600 hover:text-red-700">Ver todos</Link>
          </div>
          {loading ? (
            <div className="py-8 text-center text-neutral-400 text-sm">Cargando...</div>
          ) : recentUsers.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">No hay estudiantes aún.</div>
          ) : (
            <ul className="space-y-3">
              {recentUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-sm font-semibold">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900 truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {u.courses?.name && u.cohorts?.name ? `${u.courses.name} Nro ${u.cohorts.name}` : '—'}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {new Date(u.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-200 ${
                link.primary
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/25 hover:shadow-red-600/30'
                  : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} /></svg>
              <span className="text-xs font-medium text-center leading-tight">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
