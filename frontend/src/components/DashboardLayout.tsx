'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="w-64 flex-shrink-0 bg-neutral-900 text-white flex flex-col">
        <div className="p-6 border-b border-neutral-800">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold">
              CD
            </div>
            <span className="font-semibold">Colorados Drive</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-red-600 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-neutral-800">
          <div className="px-4 py-2 text-sm text-neutral-400 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="bg-white border-b border-neutral-200 px-8 py-4">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
