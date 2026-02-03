'use client';

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
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  title: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const pageTitles: [string, string][] = [
    ['/admin/exams', 'Exámenes'],
    ['/admin/promotions', 'Reportes por curso'],
    ['/admin/courses', 'Cursos y materias'],
    ['/admin/users', 'Usuarios'],
    ['/admin', 'Dashboard'],
    ['/student/progress', 'Progreso'],
    ['/student/exams', 'Exámenes'],
    ['/student/subjects', 'Materias'],
    ['/student', 'Mi curso'],
  ];
  const currentTitle = pageTitles.find(([href]) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/')
  )?.[1] ?? title;

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="w-64 flex-shrink-0 bg-neutral-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-neutral-800">
          <Logo variant="compact" inverted href="/" />
        </div>
        <nav className="flex-1 p-4 space-y-0.5">
          {navItems.map((item) => {
            const isRoot = item.href === '/admin' || item.href === '/student';
            const isActive = isRoot ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
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
            onClick={logout}
            className="w-full px-4 py-2.5 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors duration-200"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="bg-white border-b border-neutral-200 px-8 py-5 shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">{currentTitle}</h1>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
