'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

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
        <div className="animate-pulse text-neutral-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-lg">
              CD
            </div>
            <span className="font-semibold text-lg text-neutral-900">Colorados Drive</span>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 road-stripes">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Escuela de Conducción
          </h1>
          <p className="text-xl text-neutral-600 mb-8">
            Formación profesional para conductores en Santo Domingo, Ecuador.
            Cursos Tipo A (Moto) y Tipo B (Auto).
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-red-600 text-white font-semibold text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
          >
            Acceder a la plataforma
          </Link>
        </div>
      </main>
    </div>
  );
}
