// pages/TeacherUsersPage.tsx — Teacher-only user management

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

interface User {
  discordId: string;
  firstName: string;
  lastName: string;
  studentId: string;
  isActive: boolean;
}

interface President {
  appointmentId: string;
  classId: string;
  studentId: string;
  appointedAt: string;
}

export function TeacherUsersPage() {
  const { principal } = useAuth();
  const { t } = useI18n();

  const [users, setUsers] = useState<User[]>([]);
  const [presidents, setPresidents] = useState<President[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'presidents'>('users');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, presRes] = await Promise.all([
        apiClient.teacher.users(),
        apiClient.teacher.presidents().catch(() => ({ presidents: [] })),
      ]);
      setUsers(usersRes.users || []);
      setPresidents(presRes.presidents || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (principal?.role !== 'teacher') {
    return (
      <div className="page-container">
        <div className="state-container">
          <div className="state-icon">🔒</div>
          <p>{t('error')}</p>
        </div>
      </div>
    );
  }

  const presidentStudentIds = presidents.map((p) => p.studentId);

  const handleDeactivate = async (user: User) => {
    if (!confirm(`${t('deactivateUser')}: ${user.firstName} ${user.lastName}?`)) return;
    try {
      await fetch(`/api/teacher/users/${user.studentId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      load();
    } catch { /* ignore */ }
  };

  const handleAppoint = async (studentId: string) => {
    try {
      await apiClient.teacher.createPresident(studentId);
      load();
    } catch { /* ignore */ }
  };

  const handleRevoke = async (studentId: string) => {
    if (!confirm(`${t('revokePresident')}?`)) return;
    try {
      await apiClient.teacher.revokePresident(studentId);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 'var(--sp-4)' }}>{t('teacherArea')}</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
        <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('users')}>{t('manageUsers')}</button>
        <button className={`btn ${tab === 'presidents' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('presidents')}>{t('rolePresident')}</button>
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : tab === 'users' ? (
        <>
          <button className="btn btn-primary mb-4" onClick={() => setShowForm(true)}>
            + {t('provisionUser')}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {users.map((u) => (
              <div key={u.studentId} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>
                    {u.firstName} {u.lastName}
                    {!u.isActive && <span className="badge badge-muted" style={{ marginLeft: 'var(--sp-2)' }}>{t('isActive')}</span>}
                  </div>
                  <div className="text-muted text-xs">
                    {t('studentId')}: {u.studentId}
                    {presidentStudentIds.includes(u.studentId) && <span className="badge badge-info" style={{ marginLeft: 'var(--sp-2)' }}>{t('rolePresident')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  {u.isActive && !presidentStudentIds.includes(u.studentId) && (
                    <button className="btn btn-ghost" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleAppoint(u.studentId)}>
                      {t('appointPresident')}
                    </button>
                  )}
                  {presidentStudentIds.includes(u.studentId) && (
                    <button className="btn btn-danger" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleRevoke(u.studentId)}>
                      {t('revokePresident')}
                    </button>
                  )}
                  {u.isActive && (
                    <button className="btn btn-outline" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleDeactivate(u)}>
                      {t('deactivateUser')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showForm && (
            <UserForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {presidents.length === 0 ? (
            <div className="state-container">
              <div className="state-icon">👥</div>
              <p>{t('none')}</p>
            </div>
          ) : presidents.map((p) => (
            <div key={p.appointmentId} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--fw-medium)' }}>{p.studentId}</div>
                <div className="text-muted text-xs">{p.appointedAt}</div>
              </div>
              <button className="btn btn-danger" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleRevoke(p.studentId)}>
                {t('revokePresident')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ firstName: '', lastName: '', studentId: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Use the teacher users create endpoint via fetch
      await fetch('/api/teacher/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 'var(--sp-4)' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 'var(--sp-4)' }}>{t('provisionUser')}</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label>{t('firstName')}</label>
            <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </div>
          <div>
            <label>{t('lastName')}</label>
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <div>
            <label>{t('studentId')}</label>
            <input className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required />
          </div>
          <div>
            <label>{t('password')}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          {error && <div className="badge badge-danger">{error}</div>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <div className="spinner" /> : t('create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
