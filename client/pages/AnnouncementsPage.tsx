// pages/AnnouncementsPage.tsx — Announcements list with create/edit/delete

import { useState, useEffect, useCallback } from 'react';
import { apiClient, Announcement } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Modal, Icon } from '../components/ui';
import './AnnouncementsPage.css';

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
    try {
      await apiClient.announcements.delete(ann.announcementId);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('announcements')}
        description={`${announcements.length} updates`}
        actions={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setEditing(null); setShowForm(true); }}
            >
              <Icon name="plus" size={14} />
              <span>{t('addAnnouncement')}</span>
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : announcements.length === 0 ? (
        <div className="card state-container" style={{ padding: 'var(--sp-8)' }}>
          <Icon name="announcements" size={36} className="text-muted" />
          <p className="text-muted text-sm">{t('noAnnouncements')}</p>
        </div>
      ) : (
        <div className="announcements-list">
          {announcements.map((ann) => (
            <div
              key={ann.announcementId}
              className={`announcement-card ${ann.isPinned ? 'is-pinned' : ''}`}
            >
              <div className="announcement-card-header">
                <div className="announcement-main">
                  <div className="announcement-title-bar">
                    {ann.isPinned && (
                      <Icon name="pin" size={15} style={{ color: 'var(--accent-amber)' }} />
                    )}
                    <span className="announcement-title">{ann.title}</span>
                    {ann.priority === 'high' && (
                      <span className="badge badge-danger">{ann.priority}</span>
                    )}
                  </div>

                  {ann.body && (
                    <p className="announcement-body-text">{ann.body}</p>
                  )}

                  <div className="announcement-footer">
                    <Icon name="clock" size={13} />
                    <span>
                      {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <div className="announcement-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => { setEditing(ann); setShowForm(true); }}
                      title={t('edit')}
                      aria-label={t('edit')}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon text-danger"
                      onClick={() => handleDelete(ann)}
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

      {showForm && canManage && (
        <AnnouncementModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function AnnouncementModal({ editing, onClose, onSaved }: {
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
    expiresAt: editing?.expiresAt || '',
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
    <Modal
      title={editing ? t('editAnnouncement') : t('addAnnouncement')}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="stack gap-4">
        <div className="field">
          <label htmlFor="ann-modal-title">{t('title')}</label>
          <input
            id="ann-modal-title"
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ann-modal-body">{t('body')}</label>
          <textarea
            id="ann-modal-body"
            className="input"
            rows={4}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="ann-modal-priority">{t('priority')}</label>
          <select
            id="ann-modal-priority"
            className="input"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="ann-modal-expiry">{t('expiryDate')} (YYYY-MM-DD)</label>
          <input
            id="ann-modal-expiry"
            className="input"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            placeholder="2026-12-31"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
          />
          <span className="text-sm">{t('pinned')}</span>
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
