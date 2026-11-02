// pages/SubjectsPage.tsx — Subject list with create/edit for presidents/teachers

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Subject } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Modal, Icon } from '../components/ui';
import './SubjectsPage.css';

export function SubjectsPage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const canManage = principal?.role === 'president' || principal?.role === 'teacher';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.subjects.list();
      setSubjects(res.subjects || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = subjects.filter((s) =>
    !search ||
    s.subjectCode.toLowerCase().includes(search.toLowerCase()) ||
    s.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (subject: Subject) => {
    if (!confirm(`${t('delete')}: ${subject.subjectCode}?`)) return;
    try {
      await apiClient.subjects.delete(subject.subjectCode);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('subjects')}
        description={`${subjects.length} subjects`}
        actions={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setEditing(null); setShowForm(true); }}
            >
              <Icon name="plus" size={14} />
              <span>{t('addSubject')}</span>
            </button>
          ) : undefined
        }
      />

      <div className="subjects-search-card">
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            style={{ paddingLeft: '34px' }}
          />
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Icon name="search" size={16} className="text-muted" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
          <Icon name="subjects" size={36} className="text-muted" />
          <p className="text-muted text-sm">{t('noSubjects')}</p>
        </div>
      ) : (
        <div className="subjects-list">
          {filtered.map((s) => (
            <div key={s.subjectCode} className="subject-card">
              <div className="subject-card-main">
                <div className="subject-card-header">
                  <span className="subject-code">{s.subjectCode}</span>
                  {s.needsReview && (
                    <span className="badge badge-warning">{t('needsReview')}</span>
                  )}
                </div>
                <div className="subject-name">{s.subjectName || '—'}</div>
                <div className="subject-meta">
                  <span>{s.credits} {t('credits')}</span>
                  <span>•</span>
                  <span>{s.instructor || '—'}</span>
                </div>
              </div>

              {canManage && (
                <div className="subject-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => { setEditing(s); setShowForm(true); }}
                    title={t('edit')}
                    aria-label={t('edit')}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon text-danger"
                    onClick={() => handleDelete(s)}
                    title={t('delete')}
                    aria-label={t('delete')}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && canManage && (
        <SubjectModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SubjectModal({ editing, onClose, onSaved }: {
  editing: Subject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    subjectCode: editing?.subjectCode || '',
    subjectName: editing?.subjectName || '',
    credits: editing?.credits || '1.0',
    instructor: editing?.instructor || '',
    needsReview: editing?.needsReview || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiClient.subjects.update(editing.subjectCode, form);
      } else {
        await apiClient.subjects.create(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? t('editSubject') : t('addSubject')}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="stack gap-4">
        <div className="field">
          <label htmlFor="subj-code">{t('subjectCode')}</label>
          <input
            id="subj-code"
            className="input"
            value={form.subjectCode}
            onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
            disabled={!!editing}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="subj-name">{t('subjectName')}</label>
          <input
            id="subj-name"
            className="input"
            value={form.subjectName}
            onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="subj-credits">{t('credits')}</label>
          <input
            id="subj-credits"
            className="input"
            type="text"
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="subj-instructor">{t('instructor')}</label>
          <input
            id="subj-instructor"
            className="input"
            value={form.instructor}
            onChange={(e) => setForm({ ...form, instructor: e.target.value })}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.needsReview}
            onChange={(e) => setForm({ ...form, needsReview: e.target.checked })}
          />
          <span className="text-sm">{t('needsReview')}</span>
        </label>

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
            {saving ? <div className="spinner" /> : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
