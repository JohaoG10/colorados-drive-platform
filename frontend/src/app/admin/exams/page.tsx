'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Exam {
  id: string;
  title: string;
  subject_id?: string;
  course_id?: string;
  question_count: number;
  passing_score: number;
  duration_minutes?: number | null;
  max_attempts?: number;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Subject {
  id: string;
  name: string;
  course_id: string;
  courses?: { name: string };
}

export default function AdminExamsPage() {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scope, setScope] = useState<'subject' | 'course'>('subject');
  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    courseId: '',
    questionCount: 10,
    passingScore: 70,
    durationMinutes: '' as number | '',
    maxAttempts: 1,
  });
  const [message, setMessage] = useState('');
  const [apiError, setApiError] = useState('');

  const load = () => {
    if (!token) return;
    setApiError('');
    const headers = getAuthHeaders(token);
    Promise.all([
      fetch(`${API_URL}/api/admin/exams`, { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d }))),
      fetch(`${API_URL}/api/admin/courses`, { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d }))),
      fetch(`${API_URL}/api/admin/subjects`, { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d }))),
    ]).then(([e, c, s]) => {
      setExams(Array.isArray(e.data) ? e.data : []);
      setCourses(Array.isArray(c.data) ? c.data : []);
      setSubjects(Array.isArray(s.data) ? s.data : []);
      if (!e.ok || !c.ok || !s.ok) {
        if (e.status === 401 || c.status === 401 || s.status === 401) {
          triggerSessionExpired();
          return;
        }
        setApiError('Error al cargar. Verifica que el backend esté corriendo.');
      }
    }).catch(() => {
      setExams([]);
      setCourses([]);
      setSubjects([]);
      setApiError('No se pudo conectar con el servidor. ¿Está el backend en ' + API_URL + '?');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const subjectId = scope === 'subject' ? form.subjectId : undefined;
    const courseId = scope === 'course' ? form.courseId : undefined;
    if ((!subjectId && !courseId) || (subjectId && courseId)) {
      setMessage('Selecciona materia O curso');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/exams`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subjectId,
          courseId,
          questionCount: form.questionCount,
          passingScore: form.passingScore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage(scope === 'subject' ? 'Examen creado. Gestiona el banco de preguntas de la materia.' : 'Examen creado. Agrega preguntas desde el detalle.');
      setForm({ title: '', subjectId: '', courseId: '', questionCount: 10, passingScore: 70, durationMinutes: '', maxAttempts: 1 });
      setShowForm(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setMessage(msg.includes('token') || msg.includes('expirad') ? 'Sesión expirada. Cierra sesión e inicia de nuevo.' : msg);
    }
  };

  const deleteExam = async (id: string) => {
    if (!confirm('¿Eliminar examen? Se borrarán las preguntas e intentos.')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/exams/${id}`, { method: 'DELETE', headers: getAuthHeaders(token!) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error('');
      setMessage('Examen eliminado');
      load();
    } catch { setMessage('Error al eliminar'); }
  };

  const getExamScope = (exam: Exam) => {
    if (exam.subject_id) {
      const s = subjects.find((x) => x.id === exam.subject_id);
      return s ? s.name : 'Materia';
    }
    const c = courses.find((x) => x.id === exam.course_id);
    return c ? c.name : 'Curso';
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="relative z-10 flex flex-wrap justify-between items-start gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Exámenes</h2>
            <p className="text-red-100 text-sm">Crea exámenes por materia o por curso y gestiona el banco de preguntas.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`px-4 py-2.5 rounded-xl font-medium transition-all ${showForm ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-red-600 hover:bg-neutral-100'}`}
          >
            {showForm ? 'Cancelar' : '+ Crear examen'}
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {apiError}
        </div>
      )}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${message.includes('cread') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.includes('cread') ? (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={createExam} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Alcance</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={scope === 'subject'} onChange={() => setScope('subject')} />
                Por materia
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={scope === 'course'} onChange={() => setScope('course')} />
                Por curso
              </label>
            </div>
          </div>
          {scope === 'subject' && (
            <div>
              <label className="block text-sm font-medium mb-1">Materia</label>
              <select
                required={scope === 'subject'}
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
              >
                <option value="">Seleccionar</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} - {s.courses?.name}</option>
                ))}
              </select>
            </div>
          )}
          {scope === 'course' && (
            <div>
              <label className="block text-sm font-medium mb-1">Curso</label>
              <select
                required={scope === 'course'}
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border"
              >
                <option value="">Seleccionar</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Título del examen</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border"
              placeholder="Ej: Examen Señales de tránsito"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad de preguntas</label>
              <input
                type="number"
                min={1}
                value={form.questionCount}
                onChange={(e) => setForm({ ...form, questionCount: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 rounded-lg border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nota mínima (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.passingScore}
                onChange={(e) => setForm({ ...form, passingScore: parseInt(e.target.value) || 70 })}
                className="w-full px-4 py-2 rounded-lg border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duración (minutos)</label>
              <input
                type="number"
                min={1}
                placeholder="Sin límite"
                value={form.durationMinutes === '' ? '' : form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 rounded-lg border"
              />
              <p className="text-xs text-neutral-500 mt-0.5">Dejar vacío = sin límite de tiempo</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Intentos máximos por usuario</label>
              <input
                type="number"
                min={1}
                value={form.maxAttempts}
                onChange={(e) => setForm({ ...form, maxAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 rounded-lg border"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
              Crear examen
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Cargando exámenes...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-neutral-600 font-medium">No hay exámenes creados</p>
            <p className="text-sm text-neutral-500 mt-1 mb-4">Crea tu primer examen con el botón de arriba</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
              Crear examen
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Examen</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Alcance</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Preguntas</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Duración</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Intentos</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Mínimo</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.id} className="border-t border-neutral-100 hover:bg-neutral-50/50">
                  <td className="px-6 py-4 font-medium text-neutral-900">{ex.title}</td>
                  <td className="px-6 py-4 text-neutral-600 text-sm">{getExamScope(ex)}</td>
                  <td className="px-6 py-4 text-neutral-600">{ex.question_count} preguntas</td>
                  <td className="px-6 py-4 text-neutral-600 text-sm">
                    {ex.duration_minutes != null ? `${ex.duration_minutes} min` : 'Sin límite'}
                  </td>
                  <td className="px-6 py-4 text-neutral-600 text-sm">{ex.max_attempts ?? 1}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700">
                      Mín. {ex.passing_score}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <Link
                        href={`/admin/exams/${ex.id}/questions`}
                        className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {ex.subject_id ? 'Gestionar banco de preguntas' : 'Agregar preguntas'}
                      </Link>
                      <button onClick={() => deleteExam(ex.id)} className="text-red-600 hover:underline text-sm">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-sm text-neutral-500">
        Para ver resultados por estudiante y curso (y las respuestas de cada examen), ve a{' '}
        <Link href="/admin/promotions" className="text-red-600 hover:underline font-medium">Reportes por curso</Link>, elige el curso y haz clic en <strong>Ver</strong> junto a cada examen.
      </p>
    </div>
  );
}
