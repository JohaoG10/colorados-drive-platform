'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  course_id: string | null;
  cohort_id: string | null;
  courses?: { name: string; code: string } | null;
  cohorts?: { id: string; name: string; code: string } | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string; code: string; course_id: string; courses?: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [form, setForm] = useState<{ email: string; password: string; fullName: string; role: 'admin' | 'student'; courseId: string; cohortId: string }>({
    email: '', password: '', fullName: '', role: 'student', courseId: '', cohortId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activityModal, setActivityModal] = useState<{ userId: string; name: string } | null>(null);
  const [activity, setActivity] = useState<{ last_active_at: string | null; total_time_seconds: number } | null>(null);
  const [editModal, setEditModal] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<{ fullName: string; role: 'admin' | 'student'; courseId: string; cohortId: string; password: string }>({
    fullName: '', role: 'student', courseId: '', cohortId: '', password: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const load = () => {
    if (!token) return;
    setApiError('');
    const headers = getAuthHeaders(token);
    fetch(`${API_URL}/api/admin/users`, { headers })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && Array.isArray(data)) {
          setUsers(data);
          setApiError('');
        } else {
          setUsers([]);
          if (status === 401) {
            triggerSessionExpired();
            return;
          }
          if (status === 403) setApiError('No tienes permiso.');
          else setApiError(data?.error || 'Error al cargar.');
        }
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (token) {
      Promise.all([
        fetch(`${API_URL}/api/admin/courses`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      ]).then(([coursesData, cohortsData]) => {
        setCourses(Array.isArray(coursesData) ? coursesData : []);
        setCohorts(Array.isArray(cohortsData) ? cohortsData : []);
      });
    }
  }, [token]);

  useEffect(() => {
    if (activityModal && token) {
      fetch(`${API_URL}/api/admin/users/${activityModal.userId}/activity`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then(setActivity)
        .catch(() => setActivity(null));
    } else {
      setActivity(null);
    }
  }, [activityModal, token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.role === 'student' && !form.cohortId) {
      setError('Selecciona el tipo de curso y el número. Si no hay cursos, créalos en Cursos y materias.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          cohortId: form.role === 'student' ? form.cohortId || null : null,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setSuccess('Usuario creado');
      setForm({ email: '', password: '', fullName: '', role: 'student', courseId: '', cohortId: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const getAssignation = (u: UserRow) => {
    if (u.cohorts) return `Curso ${u.courses?.name || ''} Nro ${u.cohorts.name}`;
    if (u.courses) return `${u.courses.name} Nro ${u.courses.code}`;
    return '-';
  };

  const openEdit = (u: UserRow) => {
    setEditModal(u);
    const cohort = cohorts.find((c) => c.id === u.cohort_id);
    setEditForm({
      fullName: u.full_name || '',
      role: (u.role as 'admin' | 'student') || 'student',
      courseId: cohort?.course_id || '',
      cohortId: u.cohort_id || '',
      password: '',
    });
    setEditError('');
    setEditSuccess('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !token) return;
    setEditError('');
    setEditSuccess('');
    if (editForm.role === 'student' && !editForm.cohortId) {
      setEditError('Selecciona el tipo de curso y el número');
      return;
    }
    try {
      const body: { fullName?: string; role?: string; cohortId?: string | null; password?: string } = {
        fullName: editForm.fullName,
        role: editForm.role,
        cohortId: editForm.cohortId || null,
      };
      if (editForm.password.trim()) body.password = editForm.password;
      const res = await fetch(`${API_URL}/api/admin/users/${editModal.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setEditSuccess('Usuario actualizado');
      setEditModal(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error');
    }
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`¿Eliminar usuario ${u.full_name || u.email}? Esta acción no se puede deshacer.`)) return;
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}`, { method: 'DELETE', headers: getAuthHeaders(token) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      load();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  return (
    <div className="space-y-6">
      {apiError && <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{apiError}</div>}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Usuarios</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
        >
          {showForm ? 'Cancelar' : 'Crear usuario'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{success}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña temporal</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre completo</label>
              <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full px-4 py-2 rounded-lg border" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '' })} className="w-full px-4 py-2 rounded-lg border">
                <option value="admin">Admin</option>
                <option value="student">Estudiante</option>
              </select>
            </div>
            {form.role === 'student' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de curso</label>
                  <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, cohortId: '' })} className="w-full px-4 py-2 rounded-lg border" required>
                    <option value="">Elegir tipo</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {courses.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No hay tipos de curso. Crea uno en Cursos y materias.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Número de curso</label>
                  <select value={form.cohortId} onChange={(e) => setForm({ ...form, cohortId: e.target.value })} className="w-full px-4 py-2 rounded-lg border" required disabled={!form.courseId}>
                    <option value="">Elegir número</option>
                    {cohorts.filter((c) => c.course_id === form.courseId).map((c) => (
                      <option key={c.id} value={c.id}>Nro {c.name}</option>
                    ))}
                  </select>
                  {form.courseId && cohorts.filter((c) => c.course_id === form.courseId).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No hay números para este tipo. Crea uno en Cursos y materias.</p>
                  )}
                </div>
              </>
            )}
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white">Crear</button>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Cargando...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Usuario</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Rol</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Curso</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actividad</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Registro</th>
                <th className="px-6 py-3 text-left text-sm font-semibold w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-sm text-neutral-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-neutral-100'}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{getAssignation(u)}</td>
                  <td className="px-6 py-4">
                    {u.role === 'student' && (
                      <button onClick={() => setActivityModal({ userId: u.id, name: u.full_name || u.email })} className="text-red-600 hover:underline text-sm">
                        Ver actividad
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-red-600 hover:underline text-sm">Editar</button>
                      <button onClick={() => deleteUser(u)} className="text-neutral-600 hover:underline text-sm">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setActivityModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Actividad: {activityModal.name}</h3>
            {activity ? (
              <div className="space-y-2">
                <p><span className="text-neutral-500">Última actividad:</span> {activity.last_active_at ? new Date(activity.last_active_at).toLocaleString() : 'N/A'}</p>
                <p><span className="text-neutral-500">Tiempo en plataforma:</span> {formatTime(activity.total_time_seconds || 0)}</p>
              </div>
            ) : (
              <p className="text-neutral-500">Cargando...</p>
            )}
            <button onClick={() => setActivityModal(null)} className="mt-4 px-4 py-2 rounded-lg border">Cerrar</button>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Editar usuario: {editModal.email}</h3>
            {editError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{editError}</div>}
            {editSuccess && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm mb-4">{editSuccess}</div>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <input type="text" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-4 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '' })} className="w-full px-4 py-2 rounded-lg border">
                  <option value="admin">Admin</option>
                  <option value="student">Estudiante</option>
                </select>
              </div>
              {editForm.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de curso</label>
                    <select value={editForm.courseId} onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value, cohortId: '' })} className="w-full px-4 py-2 rounded-lg border" required>
                      <option value="">Elegir tipo</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Número de curso</label>
                    <select value={editForm.cohortId} onChange={(e) => setEditForm({ ...editForm, cohortId: e.target.value })} className="w-full px-4 py-2 rounded-lg border" required disabled={!editForm.courseId}>
                      <option value="">Elegir número</option>
                      {cohorts.filter((c) => c.course_id === editForm.courseId).map((c) => (
                        <option key={c.id} value={c.id}>Nro {c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Nueva contraseña (opcional)</label>
                <input type="password" minLength={6} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Dejar en blanco para no cambiar" className="w-full px-4 py-2 rounded-lg border" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 text-white">Guardar</button>
                <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 rounded-lg border">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
