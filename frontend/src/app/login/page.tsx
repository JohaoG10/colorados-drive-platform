'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/student');
    }
  }, [user, authLoading, router]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-pulse text-neutral-400">Cargando...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2 mb-10">
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-xl">
              CD
            </div>
            <span className="font-semibold text-xl text-neutral-900">Colorados Drive</span>
          </Link>

          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Iniciar sesión</h1>
          <p className="text-neutral-500 mb-8">Ingresa tus credenciales para acceder</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 road-stripes bg-neutral-900 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 rounded-2xl bg-red-600 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6">
            CD
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Formación profesional de conductores
          </h2>
          <p className="text-neutral-400">
            Cursos Tipo A y Tipo B. Contenido teórico, exámenes y seguimiento de progreso.
          </p>
        </div>
      </div>
    </div>
  );
}
