'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function DashboardLayout({
  children,
  navItems,
  title,
  headerRight,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  title: string;
  headerRight?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitles: [string, string][] = [
    ['/admin/notifications', 'Avisos'],
    ['/admin/exams', 'Exámenes'],
    ['/admin/promotions', 'Reportes por curso'],
    ['/admin/courses', 'Cursos y materias'],
    ['/admin/users', 'Usuarios'],
    ['/admin', 'Dashboard'],
    ['/student/progress', 'Progreso'],
    ['/student/notifications', 'Avisos'],
    ['/student/exams', 'Exámenes'],
    ['/student/subjects', 'Materias'],
    ['/student', 'Mi curso'],
  ];
  const currentTitle = pageTitles.find(([href]) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/')
  )?.[1] ?? title;

  const navContent = (
    <>
      <div className="p-4 md:p-6 border-b border-neutral-800 flex items-center justify-between md:block">
        <Logo variant="compact" inverted href="/" />
        <button
          type="button"
          className="md:hidden p-2 -m-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isRoot = item.href === '/admin' || item.href === '/student';
          const isActive = isRoot ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-neutral-800">
        <div className="px-4 py-2 text-sm text-neutral-400 truncate" title={user?.email}>{user?.email}</div>
        <button
          onClick={() => {
            setMobileMenuOpen(false);
            logout();
          }}
          className="w-full px-4 py-2.5 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors duration-200"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Sidebar: drawer en móvil, fijo en desktop */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40 w-64 flex-shrink-0 bg-neutral-900 text-white flex flex-col shadow-xl
          transform transition-transform duration-200 ease-out
          md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {navContent}
      </aside>

      {/* Overlay móvil cuando el menú está abierto */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <main className="flex-1 flex flex-col overflow-auto min-w-0">
        <header className="bg-white border-b border-neutral-200 px-4 sm:px-6 md:px-8 py-4 md:py-5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 -m-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 truncate">{currentTitle}</h1>
          </div>
          {headerRight}
        </header>
        <div className="flex-1 p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
