'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/student');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      formRef.current?.classList.add('animate-shake');
      setTimeout(() => formRef.current?.classList.remove('animate-shake'), 400);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
      {/* Fondo dinámico */}
      <div className="absolute inset-0 bg-neutral-950">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(185, 28, 28, 0.25), transparent),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(220, 38, 38, 0.15), transparent),
              radial-gradient(ellipse 50% 30% at 50% 80%, rgba(127, 29, 29, 0.2), transparent)
            `,
          }}
        />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-red-600/20 blur-[120px] -top-40 -left-40 animate-float" />
        <div
          className="absolute w-[400px] h-[400px] rounded-full bg-red-500/10 blur-[100px] bottom-0 right-0"
          style={{ animation: 'float 22s ease-in-out infinite reverse', animationDelay: '-5s' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Panel izquierdo: formulario centrado */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[420px]">
          <div
            className="relative rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-white/20 p-8 sm:p-10 login-stagger"
            style={{ animation: 'login-fade-in-up 0.6s ease-out' }}
          >
            <div className="mb-8">
              <Logo variant="large" href="/" className="inline-block" />
            </div>

            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                Bienvenido
              </h1>
              <p className="mt-1.5 text-neutral-500 text-sm sm:text-base">
                Ingresa tus credenciales para acceder a tu curso
              </p>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
                  role="alert"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                  Correo electrónico
                </label>
                <div
                  className={`
                    flex items-center gap-3 rounded-xl border bg-neutral-50/50 transition-all duration-200
                    ${focused === 'email'
                      ? 'border-red-500 ring-2 ring-red-500/20 bg-white'
                      : 'border-neutral-200 hover:border-neutral-300'
                    }
                  `}
                >
                  <span className="pl-4 text-neutral-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    required
                    autoComplete="email"
                    className="flex-1 py-3.5 pr-4 bg-transparent border-0 outline-none text-neutral-900 placeholder:text-neutral-400 text-sm sm:text-base"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                  Contraseña
                </label>
                <div
                  className={`
                    flex items-center gap-3 rounded-xl border bg-neutral-50/50 transition-all duration-200
                    ${focused === 'password'
                      ? 'border-red-500 ring-2 ring-red-500/20 bg-white'
                      : 'border-neutral-200 hover:border-neutral-300'
                    }
                  `}
                >
                  <span className="pl-4 text-neutral-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    autoComplete="current-password"
                    className="flex-1 py-3.5 pr-4 bg-transparent border-0 outline-none text-neutral-900 placeholder:text-neutral-400 text-sm sm:text-base"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full py-4 rounded-xl font-semibold text-white
                  bg-gradient-to-b from-red-600 to-red-700
                  shadow-lg shadow-red-600/30
                  hover:from-red-500 hover:to-red-600
                  hover:shadow-xl hover:shadow-red-500/35 hover:-translate-y-0.5
                  active:translate-y-0 active:shadow-md
                  disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  transition-all duration-200
                "
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              ¿Problemas para acceder? Contacta a tu instructor.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-neutral-500">
            Colorados Drive · Santo Domingo, Ecuador
          </p>
        </div>
      </div>

      {/* Panel derecho: branding (solo desktop) */}
      <div className="hidden lg:flex relative z-10 flex-1 flex-col justify-between p-12 xl:p-16 text-white">
        <div />
        <div className="space-y-8 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
            Formación profesional
            <br />
            <span className="text-red-400">de conductores</span>
          </h2>
          <p className="text-neutral-400 text-lg">
            Cursos Tipo A y Tipo B. Material teórico, exámenes prácticos y seguimiento de tu progreso.
          </p>
          <ul className="space-y-4">
            {['Contenido teórico', 'Exámenes en línea', 'Seguimiento de progreso'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-neutral-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-neutral-500 text-sm">Santo Domingo, Ecuador</p>
      </div>
    </div>
  );
}
