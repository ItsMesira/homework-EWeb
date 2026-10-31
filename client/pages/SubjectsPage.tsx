// pages/SubjectsPage.tsx — Subject list with create/edit for presidents/teachers

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Subject } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

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
    try { await apiClient.subjects.delete(subject.subjectCode); load(); }
    catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('subjects')}</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            + {t('addSubject')}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📚</div>
          <p>{t('noSubjects')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {filtered.map((s) => (
            <div key={s.subjectCode} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-lg)' }}>{s.subjectCode}</span>
                  {s.needsReview && <span className="badge badge-warning">{t('needsReview')}</span>}
                </div>
                <div className="text-muted text-sm">{s.subjectName || '—'}</div>
                <div className="text-muted text-xs mt-2">
                  {s.credits} {t('credits')} • {s.instructor || '—'}
                </div>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn btn-outline" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => { setEditing(s); setShowForm(true); }}>
                    {t('edit')}
                  </button>
                  <button className="btn btn-danger" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleDelete(s)}>
                    {t('delete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && canManage && (
        <SubjectForm
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SubjectForm({ editing, onClose, onSaved }: {
  editing: Subject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    subjectCode: editing?.subjectCode || '',
    subjectName: editing?.subjectName || '',
    credits: editing?.credits || '',
    instructor: editing?.instructor || '',
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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 'var(--sp-4)' }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 'var(--sp-4)' }}>{editing ? t('editSubject') : t('addSubject')}</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label>{t('subjectCode')}</label>
            <input className="input" value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })} disabled={!!editing} required />
          </div>
          <div>
            <label>{t('subjectName')}</label>
            <input className="input" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} />
          </div>
          <div>
            <label>{t('credits')}</label>
            <input className="input" type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
          </div>
          <div>
            <label>{t('instructor')}</label>
            <input className="input" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
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
