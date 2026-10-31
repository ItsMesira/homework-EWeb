// pages/HomeworkPage.tsx — Homework list with filters, completion toggle, create/edit

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Homework, Subject } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

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
      setHomework(hwRes.homework || []);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('homework')}</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            + {t('addHomework')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label>{t('search')}</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
        </div>
        <div>
          <label>{t('subject')}</label>
          <select className="input" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">{t('all')}</option>
            {subjects.map((s) => (
              <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode}</option>
            ))}
          </select>
        </div>
        <div>
          <label>{t('status')}</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
        <div className="state-container">
          <div className="state-icon">📝</div>
          <p>{t('noHomework')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {homework.map((hw) => (
            <div key={hw.homeworkId} className="card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)' }}>
                  <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-lg)' }}>{hw.title}</span>
                  <span className="badge badge-info">{hw.subjectCode}</span>
                  {hw.isOverdue && <span className="badge badge-danger">{t('overdue')}</span>}
                </div>
                <div className="text-muted text-sm" style={{ marginBottom: 'var(--sp-1)' }}>
                  {t('dueDate')}: {hw.dueDate}
                </div>
                {hw.details && <div className="text-sm" style={{ marginBottom: 'var(--sp-1)' }}>{hw.details}</div>}
                {hw.link && <a href={hw.link} target="_blank" rel="noopener noreferrer" className="text-sm">{t('link')} →</a>}
                {canManage && (
                  <div className="text-muted text-xs mt-2">
                    {t('completedCount')}: {hw.completedCount}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', alignItems: 'flex-end' }}>
                <button
                  className={`btn ${hw.completed ? 'btn-ghost' : 'btn-outline'}`}
                  onClick={() => toggleComplete(hw)}
                  style={{ minHeight: '36px', fontSize: 'var(--fs-xs)' }}
                >
                  {hw.completed ? '✅' : '⏳'} {hw.completed ? t('completed') : t('markComplete')}
                </button>
                {canManage && (
                  <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                    <button className="btn btn-outline" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)', padding: '4px 8px' }} onClick={() => { setEditing(hw); setShowForm(true); }}>
                      {t('edit')}
                    </button>
                    <button className="btn btn-danger" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)', padding: '4px 8px' }} onClick={() => handleDelete(hw)}>
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && canManage && (
        <HomeworkForm
          editing={editing}
          subjects={subjects}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function HomeworkForm({ editing, subjects, onClose, onSaved }: {
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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 'var(--sp-4)' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 'var(--sp-4)' }}>{editing ? t('editHomework') : t('addHomework')}</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label>{t('subject')}</label>
            <select className="input" value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })} required>
              <option value="">— {t('subject')} —</option>
              {subjects.map((s) => (
                <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} — {s.subjectName}</option>
              ))}
            </select>
          </div>
          <div>
            <label>{t('title')}</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label>{t('details')}</label>
            <textarea className="input" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </div>
          <div>
            <label>{t('dueDate')} (YYYY-MM-DD HH:MM)</label>
            <input className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} placeholder="2025-12-31 23:59" required />
          </div>
          <div>
            <label>{t('link')}</label>
            <input className="input" type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          </div>
          {error && <div className="badge badge-danger">{error}</div>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <div className="spinner" /> : t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
