'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(user.role === 'admin' ? '/admin' : '/student');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo variant="default" href="/" />
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all shadow-md shadow-red-600/20 hover:shadow-red-600/30"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-900 mb-6 leading-tight">
            Escuela de Conducción
            <span className="block text-red-600">Colorados Drive</span>
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 mb-10 max-w-xl mx-auto">
            Formación profesional para conductores en Santo Domingo, Ecuador.
            Cursos Tipo A (Moto) y Tipo B (Auto).
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-red-600 text-white font-semibold text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-600/25 hover:shadow-red-600/30 hover:-translate-y-0.5"
          >
            Acceder a la plataforma
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
