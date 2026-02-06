'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Subject {
  id: string;
  name: string;
  course_id: string;
  courses?: { name: string; code: string };
}

interface Content {
  id: string;
  title: string;
  body: string | null;
  external_link: string | null;
  file_url: string | null;
}

export default function AdminCoursesPage() {
  const { token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'courses' | 'subjects' | 'content'>('courses');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showContentForm, setShowContentForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [contents, setContents] = useState<Content[]>([]);
  const [subjectForm, setSubjectForm] = useState({ courseId: '', name: '' });
  const [contentForm, setContentForm] = useState({ subjectId: '', title: '', body: '', externalLink: '', fileUrl: '' });
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: '' });
  const [showNumberForm, setShowNumberForm] = useState(false);
  const [numberForm, setNumberForm] = useState({ courseId: '', number: '' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [message, setMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const [cohorts, setCohorts] = useState<{ id: string; name: string; code: string; course_id: string; courses?: { name: string } }[]>([]);

  const load = () => {
    if (!token) return;
    setApiError('');
    const headers = getAuthHeaders(token);
    Promise.all([
      fetch(`${API_URL}/api/admin/courses`, { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d }))),
      fetch(`${API_URL}/api/admin/subjects`, { headers }).then((r) => r.json().then((d) => ({ ok: r.ok, status: r.status, data: d }))),
    ]).then(([c, s]) => {
      setCourses(Array.isArray(c.data) ? c.data : []);
      setSubjects(Array.isArray(s.data) ? s.data : []);
      if (!c.ok || !s.ok) {
        if (c.status === 401 || s.status === 401) {
          triggerSessionExpired();
          return;
        }
        setApiError('Error al cargar. Verifica que el backend esté corriendo.');
      }
    }).catch(() => {
      setCourses([]);
      setSubjects([]);
      setApiError('No se pudo conectar con el servidor. ¿Está el backend en ' + API_URL + '?');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (token) {
      fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then((data) => setCohorts(Array.isArray(data) ? data : []))
        .catch(() => setCohorts([]));
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      const url = selectedCourse ? `${API_URL}/api/admin/subjects?courseId=${selectedCourse}` : `${API_URL}/api/admin/subjects`;
      fetch(url, { headers: getAuthHeaders(token) })
        .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
        .then(({ data }) => setSubjects(Array.isArray(data) ? data : []))
        .catch(() => setSubjects([]));
    }
  }, [selectedCourse, token]);

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!courseForm.name.trim()) {
      setMessage('El nombre del curso es obligatorio.');
      return;
    }
    try {
      const name = courseForm.name.trim();
      const code = name.substring(0, 20).toUpperCase().replace(/\s+/g, '_');
      const res = await fetch(`${API_URL}/api/admin/courses`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (res.status === 401) {
        triggerSessionExpired();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage('Tipo de curso creado. Ahora puedes crear números de curso.');
      setCourseForm({ name: '' });
      setShowCourseForm(false);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error');
    }
  };

  const createNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!numberForm.courseId || !numberForm.number.trim()) {
      setMessage('Elige el tipo de curso y escribe el número.');
      return;
    }
    try {
      const num = numberForm.number.trim();
      const res = await fetch(`${API_URL}/api/admin/cohorts`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: numberForm.courseId, name: num, code: num }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage('Número de curso creado. Ya puedes matricular usuarios.');
      setNumberForm({ courseId: '', number: '' });
      setShowNumberForm(false);
      if (token) {
        fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
          .then((r) => r.json())
          .then((data) => setCohorts(Array.isArray(data) ? data : []));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error');
    }
  };

  const deleteCohort = async (id: string) => {
    if (!confirm('¿Eliminar este número de curso? Los estudiantes quedarán sin curso asignado.')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/cohorts/${id}`, { method: 'DELETE', headers: getAuthHeaders(token!) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error('');
      setMessage('Número de curso eliminado');
      if (token) {
        fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) })
          .then((r) => r.json())
          .then((data) => setCohorts(Array.isArray(data) ? data : []));
      }
    } catch { setMessage('Error al eliminar'); }
  };

  const createSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/subjects`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: subjectForm.courseId, name: subjectForm.name }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage('Materia creada');
      setSubjectForm({ courseId: '', name: '' });
      setShowSubjectForm(false);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error');
    }
  };

  const loadContents = (subjectId?: string) => {
    const id = subjectId ?? selectedSubject;
    if (!id || !token) return;
    fetch(`${API_URL}/api/admin/subjects/${id}/contents`, { headers: getAuthHeaders(token!) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ data }) => setContents(Array.isArray(data) ? data : []))
      .catch(() => setContents([]));
  };

  const uploadFile = async (file: File) => {
    if (!token) return null;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/admin/upload?folder=contents`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      return data.url as string;
    } catch {
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const createContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/admin/contents`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: selectedSubject || contentForm.subjectId,
          title: contentForm.title,
          body: contentForm.body || undefined,
          externalLink: contentForm.externalLink || undefined,
          fileUrl: contentForm.fileUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage('Contenido creado');
      setContentForm({ subjectId: '', title: '', body: '', externalLink: '', fileUrl: '' });
      setShowContentForm(false);
      loadContents();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error');
    }
  };

  const filteredSubjects = selectedCourse ? subjects.filter((s) => s.course_id === selectedCourse) : subjects;

  const deleteCourse = async (id: string) => {
    if (!confirm('¿Eliminar curso? Se borrarán materias, contenidos y promociones asociadas.')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/courses/${id}`, { method: 'DELETE', headers: getAuthHeaders(token!) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error('');
      setMessage('Curso eliminado');
      load();
    } catch { setMessage('Error al eliminar'); }
  };

  const deleteSubject = async (id: string) => {
    if (!confirm('¿Eliminar materia y su contenido?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/subjects/${id}`, { method: 'DELETE', headers: getAuthHeaders(token!) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error('');
      setMessage('Materia eliminada');
      load();
    } catch { setMessage('Error al eliminar'); }
  };

  const deleteContent = async (id: string) => {
    if (!confirm('¿Eliminar contenido?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/contents/${id}`, { method: 'DELETE', headers: getAuthHeaders(token!) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error('');
      setMessage('Contenido eliminado');
      loadContents();
    } catch { setMessage('Error al eliminar'); }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Cursos y materias</h2>
          <p className="text-red-100 text-sm">Tipos de curso, números, materias y contenido teórico.</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab('courses')}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${tab === 'courses' ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}
        >
          Tipos de curso
        </button>
        <button
          onClick={() => setTab('subjects')}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${tab === 'subjects' ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}
        >
          Materias
        </button>
        <button
          onClick={() => { setTab('content'); loadContents(); }}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${tab === 'content' ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}
        >
          Contenido
        </button>
      </div>

      {apiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 shadow-sm">{apiError}</div>
      )}
      {message && (
        <div className={`p-4 rounded-xl shadow-sm ${message.includes('cread') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      {tab === 'courses' && (
        <>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() => { setShowCourseForm(true); setShowNumberForm(false); }}
                className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shadow-md hover:shadow-lg transition-all duration-200"
              >
                + Crear tipo de curso
              </button>
              <button
                onClick={() => { setShowNumberForm(true); setShowCourseForm(false); }}
                disabled={courses.length === 0}
                className="px-5 py-2.5 rounded-lg bg-neutral-700 text-white font-medium hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200"
                title={courses.length === 0 ? 'Primero crea un tipo de curso' : ''}
              >
                + Crear número de curso
              </button>
              {courses.length === 0 && (
                <span className="text-sm text-amber-600">Primero crea un tipo de curso (Tipo A o B).</span>
              )}
            </div>

            {showCourseForm && (
              <form onSubmit={createCourse} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                <h3 className="font-semibold text-neutral-900">Crear tipo de curso (Tipo A, Tipo B, etc.)</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre del tipo de curso</label>
                  <input
                    type="text"
                    required
                    value={courseForm.name}
                    onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                    placeholder="Ej: Tipo A, Tipo B"
                    className="w-full px-4 py-2 rounded-lg border"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Crear tipo de curso</button>
                  <button type="button" onClick={() => setShowCourseForm(false)} className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 transition-colors">Cancelar</button>
                </div>
              </form>
            )}

            {showNumberForm && (
              <form onSubmit={createNumber} className="bg-white rounded-xl border p-6 space-y-4">
                <h3 className="font-semibold text-neutral-900">Crear número de curso</h3>
                <p className="text-sm text-neutral-500">Elige el tipo de curso y solo pon el número. No pongas el nombre otra vez.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de curso</label>
                    <select
                      required
                      value={numberForm.courseId}
                      onChange={(e) => setNumberForm({ ...numberForm, courseId: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border"
                    >
                      <option value="">Elegir tipo</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Número</label>
                    <input
                      type="text"
                      required
                      value={numberForm.number}
                      onChange={(e) => setNumberForm({ ...numberForm, number: e.target.value })}
                      placeholder="Ej: 2, 3, 200"
                      className="w-full px-4 py-2 rounded-lg border"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Crear número de curso</button>
                  <button type="button" onClick={() => setShowNumberForm(false)} className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 transition-colors">Cancelar</button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-neutral-50/80">
              <h3 className="font-semibold text-neutral-900">Tipos de curso</h3>
            </div>
            {loading ? <div className="p-8 text-center text-neutral-500">Cargando...</div> : courses.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay tipos de curso. Crea el primero.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                <thead className="bg-neutral-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Nombre</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{c.name}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => deleteCourse(c.id)} className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium transition-colors">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b bg-neutral-50/80">
              <h3 className="font-semibold text-neutral-900">Números de curso creados</h3>
            </div>
            {cohorts.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No hay números de curso. Crea uno arriba.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                <thead className="bg-neutral-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Curso completo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((co) => (
                    <tr key={co.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{co.courses?.name || 'Curso'} Nro {co.name}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => deleteCohort(co.id)} className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium transition-colors">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'subjects' && (
        <>
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex gap-2">
              <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-4 py-2 rounded-lg border border-neutral-300"
            >
              <option value="">Todos los cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
              <button
                onClick={() => setShowSubjectForm(true)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
              >
                + Crear materia
              </button>
            </div>
          </div>

          {showSubjectForm && (
            <form onSubmit={createSubject} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div>
                <label className="block text-sm font-medium mb-1">Curso</label>
                <select
                  required
                  value={subjectForm.courseId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, courseId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                >
                  <option value="">Seleccionar</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre de la materia</label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Ej: Señales de tránsito"
                  className="w-full px-4 py-2 rounded-lg border"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Crear</button>
                <button type="button" onClick={() => setShowSubjectForm(false)} className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 transition-colors">Cancelar</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-neutral-500">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                <thead className="bg-neutral-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Materia</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Curso</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700 w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((s) => (
                    <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900">{s.name}</td>
                      <td className="px-6 py-4 text-neutral-600">{s.courses ? `${s.courses.name} (${s.courses.code})` : '-'}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => deleteSubject(s.id)} className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium transition-colors">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'content' && (
        <>
          <div className="flex gap-4">
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setSelectedSubject(''); }}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="">Curso</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedSubject}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedSubject(v);
                setContentForm((f) => ({ ...f, subjectId: v }));
                if (v) loadContents(v);
              }}
              className="px-4 py-2 rounded-lg border"
            >
              <option value="">Materia</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setShowContentForm(true); loadContents(); }}
              disabled={!selectedSubject}
              className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Crear contenido
            </button>
          </div>

          {showContentForm && selectedSubject && (
            <form onSubmit={createContent} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <input type="hidden" value={selectedSubject} onChange={() => {}} />
              <div>
                <label className="block text-sm font-medium mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={contentForm.title}
                  onChange={(e) => setContentForm({ ...contentForm, title: e.target.value, subjectId: selectedSubject })}
                  className="w-full px-4 py-2 rounded-lg border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contenido (texto)</label>
                <textarea
                  value={contentForm.body}
                  onChange={(e) => setContentForm({ ...contentForm, body: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Enlace externo (opcional)</label>
                <input
                  type="url"
                  value={contentForm.externalLink}
                  onChange={(e) => setContentForm({ ...contentForm, externalLink: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-lg border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Archivo adjunto (opcional)</label>
                <p className="text-xs text-neutral-500 mb-1">PDF, imágenes, Word. Máx. 10MB</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file);
                    if (url) setContentForm((f) => ({ ...f, fileUrl: url }));
                    else setMessage('Error al subir archivo');
                  }}
                  className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:font-medium"
                />
                {uploadingFile && <span className="text-sm text-neutral-500">Subiendo...</span>}
                {contentForm.fileUrl && (
                  <p className="text-sm text-green-600 mt-1">✓ Archivo subido</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Crear</button>
                <button type="button" onClick={() => setShowContentForm(false)} className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 transition-colors">Cancelar</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            {contents.length === 0 && selectedSubject ? (
              <div className="p-8 text-center text-neutral-500">Sin contenido. Crea el primero.</div>
            ) : (
              <ul className="divide-y">
                {contents.map((c) => (
                  <li key={c.id} className="px-6 py-4 flex justify-between items-start border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors">
                    <div>
                      <p className="font-medium text-neutral-900">{c.title}</p>
                      {c.external_link && <a href={c.external_link} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:underline block">{c.external_link}</a>}
                      {c.file_url && <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:underline block">📎 Ver archivo adjunto</a>}
                    </div>
                    <button onClick={() => deleteContent(c.id)} className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium shrink-0 transition-colors">Eliminar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
