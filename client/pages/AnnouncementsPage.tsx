// pages/AnnouncementsPage.tsx — Announcements list with create/edit/delete

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Announcement } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';

export function AnnouncementsPage() {
  const { principal } = useAuth();
  const { t, lang } = useI18n();
  const canManage = principal?.role === 'president' || principal?.role === 'teacher';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.announcements.list();
      setAnnouncements(res.announcements || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (ann: Announcement) => {
    if (!confirm(`${t('delete')}: ${ann.title}?`)) return;
    try { await apiClient.announcements.delete(ann.announcementId); load(); }
    catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1>{t('announcements')}</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            + {t('addAnnouncement')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : announcements.length === 0 ? (
        <div className="state-container">
          <div className="state-icon">📢</div>
          <p>{t('noAnnouncements')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {announcements.map((ann) => (
            <div key={ann.announcementId} className="card" style={{ borderLeft: ann.isPinned ? '3px solid var(--primary)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)' }}>
                    {ann.isPinned && <span>📌</span>}
                    <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-lg)' }}>{ann.title}</span>
                    {ann.priority === 'high' && <span className="badge badge-danger">{ann.priority}</span>}
                  </div>
                  {ann.body && (
                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--sp-2)' }}>
                      {ann.body}
                    </div>
                  )}
                  <div className="text-muted text-xs">
                    {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                    <button className="btn btn-outline" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => { setEditing(ann); setShowForm(true); }}>
                      {t('edit')}
                    </button>
                    <button className="btn btn-danger" style={{ minHeight: '32px', fontSize: 'var(--fs-xs)' }} onClick={() => handleDelete(ann)}>
                      {t('delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && canManage && (
        <AnnouncementForm
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );

}

function AnnouncementForm({ editing, onClose, onSaved }: {
  editing: Announcement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: editing?.title || '',
    body: editing?.body || '',
    priority: editing?.priority || 'normal',
    isPinned: editing?.isPinned || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiClient.announcements.update(editing.announcementId, form);
      } else {
        await apiClient.announcements.create(form);
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
        <h2 style={{ marginBottom: 'var(--sp-4)' }}>{editing ? t('editAnnouncement') : t('addAnnouncement')}</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div>
            <label>{t('title')}</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label>{t('body')}</label>
            <textarea className="input" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div>
            <label>{t('priority')}</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <input type="checkbox" id="pinned" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
            <label htmlFor="pinned" style={{ margin: 0 }}>{t('pinned')}</label>
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
