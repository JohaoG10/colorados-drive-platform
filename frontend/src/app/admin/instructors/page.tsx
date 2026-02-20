'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Instructor {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminInstructorsPage() {
  const { token } = useAuth();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [editModal, setEditModal] = useState<Instructor | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '', isActive: true });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const load = () => {
    if (!token) return;
    setApiError('');
    fetch(`${API_URL}/api/admin/instructors`, { headers: getAuthHeaders(token) })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && Array.isArray(data)) {
          setInstructors(data);
        } else {
          setInstructors([]);
          if (status === 401) triggerSessionExpired();
          else setApiError(data?.error || 'Error al cargar instructores.');
        }
      })
      .catch(() => setInstructors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.fullName.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/instructors`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error al crear');
      setFormSuccess('Instructor creado correctamente.');
      setForm({ fullName: '', email: '', phone: '', isActive: true });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !token) return;
    setEditError('');
    setEditSuccess('');
    if (!editForm.fullName.trim()) {
      setEditError('El nombre es obligatorio.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/instructors/${editModal.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          isActive: editForm.isActive,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');
      setEditSuccess('Instructor actualizado.');
      setEditModal(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (inst: Instructor) => {
    if (!confirm(`¿Eliminar al instructor "${inst.full_name}"? Esta acción no se puede deshacer.`)) return;
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/instructors/${inst.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      if (res.status === 401) { triggerSessionExpired(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      load();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const openEdit = (inst: Instructor) => {
    setEditModal(inst);
    setEditForm({
      fullName: inst.full_name || '',
      email: inst.email || '',
      phone: inst.phone || '',
      isActive: inst.is_active,
    });
    setEditError('');
    setEditSuccess('');
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Instructores</h2>
          <p className="text-red-100 text-sm">Gestiona instructores. Todos tienen disponibilidad de 6:00 a 23:00 (horas enteras). Los horarios se asignan al inscribir alumnos.</p>
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setShowForm(!showForm); setFormError(''); setFormSuccess(''); setForm({ fullName: '', email: '', phone: '', isActive: true }); }}
          className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md shadow-red-600/20 transition-all"
        >
          {showForm ? 'Cancelar' : 'Nuevo instructor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 shadow-sm">
          {formError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">{formError}</div>}
          {formSuccess && <div className="p-3 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm">{formSuccess}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre completo *</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                placeholder="instructor@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                placeholder="Ej: 0991234567"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-neutral-700">Activo</label>
            </div>
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition-all">
            Crear instructor
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Teléfono</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700 w-32">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((inst) => (
                  <tr key={inst.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-900">{inst.full_name}</td>
                    <td className="px-6 py-4 text-neutral-600">{inst.email || '-'}</td>
                    <td className="px-6 py-4 text-neutral-600">{inst.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${inst.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-600'}`}>
                        {inst.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(inst)} className="text-red-600 hover:underline text-sm">Editar</button>
                        <button type="button" onClick={() => handleDelete(inst)} className="text-neutral-600 hover:underline text-sm">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {instructors.length === 0 && !loading && (
              <div className="p-8 text-center text-neutral-500">No hay instructores. Crea uno para comenzar.</div>
            )}
          </div>
        )}
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-neutral-900 mb-4">Editar instructor</h3>
            {editError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm mb-4">{editError}</div>}
            {editSuccess && <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm mb-4">{editSuccess}</div>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="editIsActive" className="text-sm font-medium text-neutral-700">Activo</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition-all">
                  Guardar
                </button>
                <button type="button" onClick={() => setEditModal(null)} className="px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
