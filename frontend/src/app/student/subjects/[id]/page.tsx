'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Content {
  id: string;
  title: string;
  body: string | null;
  external_link: string | null;
  file_url: string | null;
  order_index: number;
}

interface Subject {
  id: string;
  name: string;
}

export default function SubjectContentPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const id = params.id as string;
  const [contents, setContents] = useState<Content[]>([]);
  const [subjectName, setSubjectName] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    fetch(`${API_URL}/api/student/subjects/${id}/contents`, { headers: getAuthHeaders(token) })
      .then((r) => {
        if (!r.ok) throw new Error('');
        return r.json();
      })
      .then((data) => {
        setContents(data);
        if (data[0]) setSubjectName(data[0].subject_name || '');
      })
      .catch(() => router.push('/student/subjects'));
  }, [token, id, router]);

  const subjectsRes = () => {
    if (!token) return;
    fetch(`${API_URL}/api/student/subjects`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((subs: Subject[]) => {
        const s = subs.find((x) => x.id === id);
        if (s) setSubjectName(s.name);
      });
  };

  useEffect(() => {
    subjectsRes();
  }, [token, id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/student/subjects"
          className="text-neutral-500 hover:text-red-600 flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Materias
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium text-neutral-900">{subjectName || 'Cargando...'}</span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-red-600/10 to-red-600/5 border border-red-200/50 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-neutral-900">{subjectName || 'Cargando...'}</h1>
        <p className="text-neutral-500 text-sm mt-1">Contenido teórico de la materia</p>
      </div>

      <div className="space-y-6">
        {contents.map((c, i) => (
          <article key={c.id} className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center text-sm font-medium shrink-0">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold text-neutral-900">{c.title}</h3>
            </div>
            {c.body && (
              <div className="prose prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap pl-11">
                {c.body}
              </div>
            )}
            {c.external_link && (
              <a
                href={c.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-red-600 hover:underline pl-11"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver enlace externo
              </a>
            )}
            {c.file_url && (
              <a
                href={c.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-red-600 hover:underline pl-11"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar archivo adjunto
              </a>
            )}
          </article>
        ))}
      </div>

      {contents.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">Sin contenido</p>
          <p className="text-sm text-neutral-500 mt-1">No hay contenido disponible en esta materia.</p>
        </div>
      )}
    </div>
  );
}
