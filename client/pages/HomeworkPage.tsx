// pages/HomeworkPage.tsx — Homework list with filters, completion toggle, create/edit

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Homework, Subject } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Modal, Icon } from '../components/ui';
import './HomeworkPage.css';

export function HomeworkPage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const canManage = principal?.role === 'president' || principal?.role === 'teacher';

  const [loading, setLoading] = useState(true);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Homework | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (subjectFilter) params.subjectCode = subjectFilter;
      const [hwRes, subRes] = await Promise.all([
        apiClient.homework.list(params),
        apiClient.subjects.list().catch(() => ({ subjects: [] })),
      ]);
      setHomework((hwRes.homework || []).filter((h: Homework) => !!h.homeworkId && !!h.title && h.title.trim() !== ''));
      setSubjects(subRes.subjects || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, statusFilter, subjectFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleComplete = async (hw: Homework) => {
    try {
      if (hw.completed) {
        await apiClient.homework.uncomplete(hw.homeworkId);
      } else {
        await apiClient.homework.complete(hw.homeworkId);
      }
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async (hw: Homework) => {
    if (!confirm(`${t('deleteHomework')}: ${hw.title}?`)) return;
    try {
      await apiClient.homework.delete(hw.homeworkId);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('homework')}
        description={`${homework.length} items`}
        actions={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setEditing(null); setShowForm(true); }}
            >
              <Icon name="plus" size={14} />
              <span>{t('addHomework')}</span>
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="card homework-filters">
        <div className="field homework-search-field">
          <label htmlFor="hw-search">{t('search')}</label>
          <div style={{ position: 'relative' }}>
            <input
              id="hw-search"
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

        <div className="field homework-filter-select">
          <label htmlFor="hw-subject">{t('subject')}</label>
          <select
            id="hw-subject"
            className="input"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">{t('all')}</option>
            {subjects.map((s) => (
              <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode}</option>
            ))}
          </select>
        </div>

        <div className="field homework-filter-select">
          <label htmlFor="hw-status">{t('status')}</label>
          <select
            id="hw-status"
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('all')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="overdue">{t('overdue')}</option>
            <option value="completed">{t('completed')}</option>
          </select>
        </div>
      </div>

      {/* Homework list */}
      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : homework.length === 0 ? (
        <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
          <Icon name="homework" size={36} className="text-muted" />
          <p className="text-muted text-sm">{t('noHomework')}</p>
        </div>
      ) : (
        <div className="homework-list">
          {homework.map((hw) => (
            <div
              key={hw.homeworkId}
              className={`homework-card ${hw.completed ? 'is-completed' : ''} ${hw.isOverdue && !hw.completed ? 'is-overdue' : ''}`}
            >
              <div className="homework-main">
                <div className="homework-header-row">
                  {hw.subjectCode && <span className="badge badge-info">{hw.subjectCode}</span>}
                  <span className="homework-title">{hw.title || '(ไม่มีชื่อการบ้าน)'}</span>
                  {hw.isOverdue && !hw.completed && (
                    <span className="badge badge-danger">{t('overdue')}</span>
                  )}
                  {hw.completed && (
                    <span className="badge badge-success">{t('completed')}</span>
                  )}
                </div>

                {hw.details && (
                  <p className="homework-details">{hw.details}</p>
                )}

                <div className="homework-meta">
                  <div className="homework-meta-item">
                    <Icon name="clock" size={13} />
                    <span>{t('dueDate')}: {hw.dueDate}</span>
                  </div>

                  {hw.link && (
                    <a
                      href={hw.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="homework-meta-item text-primary"
                    >
                      <Icon name="link" size={13} />
                      <span>{t('link')}</span>
                    </a>
                  )}

                  {canManage && (
                    <div className="homework-meta-item">
                      <Icon name="users" size={13} />
                      <span>{t('completedCount')}: {hw.completedCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="homework-actions">
                <button
                  type="button"
                  className={`btn homework-toggle-btn ${hw.completed ? 'completed' : 'btn-outline'}`}
                  onClick={() => toggleComplete(hw)}
                >
                  <Icon name="check" size={14} />
                  <span>{hw.completed ? t('completed') : t('markComplete')}</span>
                </button>

                {canManage && (
                  <div className="homework-admin-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => { setEditing(hw); setShowForm(true); }}
                      title={t('edit')}
                      aria-label={t('edit')}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon text-danger"
                      onClick={() => handleDelete(hw)}
                      title={t('delete')}
                      aria-label={t('delete')}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accessible Modal for Create/Edit */}
      {showForm && canManage && (
        <HomeworkModal
          editing={editing}
          subjects={subjects}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function HomeworkModal({ editing, subjects, onClose, onSaved }: {
  editing: Homework | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    subjectCode: editing?.subjectCode || '',
    title: editing?.title || '',
    details: editing?.details || '',
    imageUrl: editing?.imageUrl || '',
    link: editing?.link || '',
    dueDate: editing?.dueDate || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiClient.homework.update(editing.homeworkId, form);
      } else {
        await apiClient.homework.create(form);
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
      title={editing ? t('editHomework') : t('addHomework')}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="stack gap-4">
        <div className="field">
          <label htmlFor="hw-modal-subject">{t('subject')}</label>
          <select
            id="hw-modal-subject"
            className="input"
            value={form.subjectCode}
            onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
            required
          >
            <option value="">— {t('subject')} —</option>
            {subjects.map((s) => (
              <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} — {s.subjectName}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="hw-modal-title">{t('title')}</label>
          <input
            id="hw-modal-title"
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="hw-modal-details">{t('details')}</label>
          <textarea
            id="hw-modal-details"
            className="input"
            rows={3}
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="hw-modal-due">{t('dueDate')} (YYYY-MM-DD HH:MM)</label>
          <input
            id="hw-modal-due"
            className="input"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            placeholder="2026-12-31 23:59"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="hw-modal-link">{t('link')}</label>
          <input
            id="hw-modal-link"
            className="input"
            type="url"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
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
            {saving ? <div className="spinner" /> : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
