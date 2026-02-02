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
      <div className="flex items-center gap-4">
        <Link
          href="/student/subjects"
          className="text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Materias
        </Link>
        <span className="text-neutral-400">/</span>
        <h2 className="font-semibold text-neutral-900">{subjectName || 'Cargando...'}</h2>
      </div>

      <div className="space-y-6">
        {contents.map((c, i) => (
          <article key={c.id} className="bg-white rounded-xl border border-neutral-200 p-6">
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
        <div className="bg-white rounded-xl border p-8 text-center text-neutral-500">
          No hay contenido disponible en esta materia.
        </div>
      )}
    </div>
  );
}
