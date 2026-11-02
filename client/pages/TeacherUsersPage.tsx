// pages/TeacherUsersPage.tsx — Teacher-only user management

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Modal, Icon } from '../components/ui';
import './TeacherUsersPage.css';

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
        <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
          <Icon name="lock" size={36} className="text-danger" />
          <p className="text-muted text-sm">{t('error')}</p>
        </div>
      </div>
    );
  }

  const presidentStudentIds = presidents.map((p) => p.studentId);

  const handleDeactivate = async (user: User) => {
    if (!confirm(`${t('deactivateUser')}: ${user.firstName} ${user.lastName}?`)) return;
    try {
      await apiClient.delete(`/api/teacher/users/${user.studentId}`);
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
      <PageHeader
        title={t('teacherArea')}
        actions={
          tab === 'users' ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm(true)}
            >
              <Icon name="plus" size={14} />
              <span>{t('provisionUser')}</span>
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="tabs teacher-tabs">
        <button
          type="button"
          className={`tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Icon name="users" size={14} />
          <span>{t('manageUsers')}</span>
        </button>
        <button
          type="button"
          className={`tab ${tab === 'presidents' ? 'active' : ''}`}
          onClick={() => setTab('presidents')}
        >
          <Icon name="user" size={14} />
          <span>{t('rolePresident')}</span>
        </button>
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : tab === 'users' ? (
        <>
          <div className="teacher-user-list">
            {users.map((u) => (
              <div key={u.studentId} className="teacher-user-card">
                <div className="teacher-user-main">
                  <div className="teacher-user-name-row">
                    <span className="teacher-user-name">{u.firstName} {u.lastName}</span>
                    {!u.isActive && (
                      <span className="badge badge-muted">{t('isActive')}</span>
                    )}
                    {presidentStudentIds.includes(u.studentId) && (
                      <span className="badge badge-info">{t('rolePresident')}</span>
                    )}
                  </div>
                  <div className="teacher-user-meta">
                    {t('studentId')}: {u.studentId}
                  </div>
                </div>

                <div className="teacher-user-actions">
                  {u.isActive && !presidentStudentIds.includes(u.studentId) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleAppoint(u.studentId)}
                    >
                      {t('appointPresident')}
                    </button>
                  )}
                  {presidentStudentIds.includes(u.studentId) && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRevoke(u.studentId)}
                    >
                      {t('revokePresident')}
                    </button>
                  )}
                  {u.isActive && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleDeactivate(u)}
                    >
                      {t('deactivateUser')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showForm && (
            <UserModal
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); load(); }}
            />
          )}
        </>
      ) : (
        <div className="teacher-user-list">
          {presidents.length === 0 ? (
            <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
              <Icon name="users" size={36} className="text-muted" />
              <p className="text-muted text-sm">{t('none')}</p>
            </div>
          ) : (
            presidents.map((p) => (
              <div key={p.appointmentId} className="teacher-user-card">
                <div className="teacher-user-main">
                  <div className="teacher-user-name" style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.studentId}
                  </div>
                  <div className="teacher-user-meta">
                    {t('appointPresident')}: {p.appointedAt}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRevoke(p.studentId)}
                >
                  {t('revokePresident')}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ firstName: '', lastName: '', studentId: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/teacher/users', form);
      onSaved();
    } catch (err: any) {
      setError(err.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t('provisionUser')} onClose={onClose}>
      <form onSubmit={handleSave} className="stack gap-4">
        <div className="field">
          <label htmlFor="user-first-name">{t('firstName')}</label>
          <input
            id="user-first-name"
            className="input"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="user-last-name">{t('lastName')}</label>
          <input
            id="user-last-name"
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="user-student-id">{t('studentId')}</label>
          <input
            id="user-student-id"
            className="input"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="user-password">{t('password')}</label>
          <input
            id="user-password"
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="field-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="cluster gap-2 justify-end mt-4">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <div className="spinner" /> : t('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
