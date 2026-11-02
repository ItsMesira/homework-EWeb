// pages/TimetablePage.tsx — Weekly timetable grid (desktop) / day tabs (mobile)

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, TimetableCell, Subject } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { PageHeader, Modal, Icon } from '../components/ui';
import './TimetablePage.css';

const DAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DAY_KEYS = ['day1', 'day2', 'day3', 'day4', 'day5'] as const;

export function TimetablePage() {
  const { principal } = useAuth();
  const { t } = useI18n();
  const canManage = principal?.role === 'president' || principal?.role === 'teacher';

  const [grid, setGrid] = useState<Record<number, Record<number, TimetableCell>>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [term, setTerm] = useState(2);
  const [schoolYear, setSchoolYear] = useState(2569);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ day: number; period: number; cell: TimetableCell } | null>(null);

  // Import from image state
  const [showImportModal, setShowImportModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ttRes, subRes] = await Promise.all([
        apiClient.timetable.get(term, schoolYear),
        apiClient.subjects.list().catch(() => ({ subjects: [] })),
      ]);
      setGrid(ttRes.grid || {});
      if (ttRes.term) setTerm(ttRes.term);
      if (ttRes.schoolYear) setSchoolYear(ttRes.schoolYear);
      setSubjects(subRes.subjects || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [term, schoolYear]);

  useEffect(() => { load(); }, [load]);

  const handleCellClick = (day: number, period: number, cell: TimetableCell) => {
    if (!canManage) return;
    setEditingCell({ day, period, cell: cell || { cellType: 'free', subjectCode: '', label: '', instructor: '' } });
  };

  const getCellLabel = (cell: TimetableCell) => {
    if (!cell || cell.cellType === 'free') return t('free');
    if (cell.cellType === 'subject') return cell.subjectCode || '-';
    if (cell.cellType === 'lunch') return cell.label || t('lunch');
    if (cell.cellType === 'break') return cell.label || t('breakTime');
    if (cell.cellType === 'activity') return cell.label || t('activity');
    return cell.label || cell.cellType;
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t('timetable')}
        description={`${t('period')} 1–9 • ${DAYS.map((d) => t(DAY_KEYS[d - 1])).join(', ')}`}
        actions={
          canManage ? (
            <div className="cluster gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowImportModal(true)}
                title={t('importTimetableTitle')}
              >
                <Icon name="upload" size={14} />
                <span>{t('importTimetableTitle')}</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <div className="state-container"><div className="spinner" /></div>
      ) : (
        <>
          {/* Desktop grid */}
          <div className="timetable-desktop-wrapper timetable-card">
            <table className="timetable-table">
              <thead>
                <tr>
                  <th className="timetable-th timetable-period-th">
                    {t('period')}
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="timetable-th">
                      {t(DAY_KEYS[day - 1])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="timetable-td timetable-period-td">
                      {period}
                    </td>
                    {DAYS.map((day) => {
                      const cell = grid[day]?.[period];
                      const isSubject = cell && cell.cellType === 'subject';
                      const isFree = !cell || cell.cellType === 'free';
                      const isSpecial = cell && (cell.cellType === 'lunch' || cell.cellType === 'break' || cell.cellType === 'activity');

                      return (
                        <td
                          key={day}
                          className={`timetable-td ${canManage ? 'is-editable' : ''} ${isSubject ? 'timetable-cell-subject' : ''}`}
                          onClick={() => handleCellClick(day, period, cell)}
                          title={canManage ? `${t('editCell')} (${t(DAY_KEYS[day - 1])} P${period})` : undefined}
                        >
                          {isFree ? (
                            <span className="timetable-cell-free">{t('free')}</span>
                          ) : isSpecial ? (
                            <span className="timetable-cell-special">{getCellLabel(cell)}</span>
                          ) : (
                            <div>
                              <div className="timetable-cell-code">{getCellLabel(cell)}</div>
                              {cell?.instructor && (
                                <div className="timetable-cell-instructor">{cell.instructor}</div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view with tabs per day */}
          <div className="timetable-mobile-wrapper">
            <div className="tabs timetable-day-tabs">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`tab ${selectedDay === day ? 'active' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {t(DAY_KEYS[day - 1])}
                </button>
              ))}
            </div>

            <div className="timetable-mobile-list">
              {PERIODS.map((period) => {
                const cell = grid[selectedDay]?.[period];
                const isFree = !cell || cell.cellType === 'free';

                return (
                  <div
                    key={period}
                    className={`timetable-mobile-card ${canManage ? 'is-editable' : ''}`}
                    onClick={() => handleCellClick(selectedDay, period, cell)}
                  >
                    <div className="timetable-mobile-period">
                      <span>P{period}</span>
                    </div>
                    <div className="timetable-mobile-content">
                      {isFree ? (
                        <span className="text-muted text-sm">{t('free')}</span>
                      ) : (
                        <>
                          <div className="timetable-mobile-title">{getCellLabel(cell)}</div>
                          {cell?.instructor && (
                            <div className="timetable-mobile-instructor">{cell.instructor}</div>
                          )}
                        </>
                      )}
                    </div>
                    {canManage && (
                      <Icon name="edit" size={14} className="text-muted" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Direct Cell Edit Modal */}
      {editingCell && (
        <CellEditModal
          day={editingCell.day}
          period={editingCell.period}
          cell={editingCell.cell}
          subjects={subjects}
          term={term}
          schoolYear={schoolYear}
          onClose={() => setEditingCell(null)}
          onSaved={() => { setEditingCell(null); load(); }}
        />
      )}

      {/* Timetable Import Modal */}
      {showImportModal && (
        <ImportTimetableModal
          term={term}
          schoolYear={schoolYear}
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Cell Edit Modal ─────────────────────────────────────────────────────────

function CellEditModal({
  day,
  period,
  cell,
  subjects,
  term,
  schoolYear,
  onClose,
  onSaved,
}: {
  day: number;
  period: number;
  cell: TimetableCell;
  subjects: Subject[];
  term: number;
  schoolYear: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const dayName = t(DAY_KEYS[day - 1]);

  const [cellType, setCellType] = useState<string>(cell.cellType || 'subject');
  const [subjectCode, setSubjectCode] = useState<string>(cell.subjectCode || '');
  const [label, setLabel] = useState<string>(cell.label || '');
  const [instructor, setInstructor] = useState<string>(cell.instructor || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubjectChange = (code: string) => {
    setSubjectCode(code);
    const sub = subjects.find((s) => s.subjectCode === code);
    if (sub && sub.instructor && !instructor) {
      setInstructor(sub.instructor);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await apiClient.timetable.updateCell(term, schoolYear, day, period, {
        cellType: cellType as any,
        subjectCode: cellType === 'subject' ? subjectCode : '',
        label: cellType !== 'subject' ? label : '',
        instructor: cellType === 'subject' ? instructor : '',
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.timetable.updateCell(term, schoolYear, day, period, {
        cellType: 'free',
        subjectCode: '',
        label: '',
        instructor: '',
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${t('editCell')} — ${dayName} (${t('period')} ${period})`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="stack gap-4">
        <div className="field">
          <label>{t('cellType')}</label>
          <select
            className="input"
            value={cellType}
            onChange={(e) => setCellType(e.target.value)}
          >
            <option value="subject">{t('subject')}</option>
            <option value="free">{t('free')}</option>
            <option value="lunch">{t('lunch')}</option>
            <option value="break">{t('breakTime')}</option>
            <option value="activity">{t('activity')}</option>
          </select>
        </div>

        {cellType === 'subject' && (
          <>
            <div className="field">
              <label>{t('subject')}</label>
              <select
                className="input"
                value={subjectCode}
                onChange={(e) => handleSubjectChange(e.target.value)}
              >
                <option value="">— {t('selectSubject')} —</option>
                {subjects.map((s) => (
                  <option key={s.subjectCode} value={s.subjectCode}>
                    {s.subjectCode} — {s.subjectName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{t('subjectCode')} (Custom)</label>
              <input
                className="input"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. MA201, EN-101"
              />
            </div>

            <div className="field">
              <label>{t('instructor')}</label>
              <input
                className="input"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="Teacher name"
              />
            </div>
          </>
        )}

        {cellType !== 'subject' && cellType !== 'free' && (
          <div className="field">
            <label>{t('customLabel')}</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={cellType === 'lunch' ? t('lunch') : cellType === 'break' ? t('breakTime') : t('activity')}
            />
          </div>
        )}

        {error && (
          <div className="field-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="cluster gap-2 justify-between items-center mt-4">
          <button
            type="button"
            className="btn btn-ghost text-danger btn-sm"
            onClick={handleClear}
            disabled={saving}
          >
            {t('clearCell')}
          </button>

          <div className="cluster gap-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : t('save')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Timetable Import Modal (Paste from Sheets/Excel + Free AI Image Scan) ─────

function parseSpreadsheetText(rawText: string): Record<number, Record<number, TimetableCell>> {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const delimiter = rawText.includes('\t') ? '\t' : (rawText.includes(',') ? ',' : '\t');

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const nextChar = rawText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
    } else {
      currentCell += char;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
  }

  const isDayToken = (s: string) => /จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|mon|tue|wed|thu|fri/i.test(s);
  const isPeriodToken = (s: string) => /^\d+$/.test(s) || /คาบ|period/i.test(s);

  const row0Days = rows.length > 0 ? rows[0].filter(isDayToken).length : 0;
  const col0Days = rows.filter((r) => isDayToken(r[0] || '')).length;

  let orientation: 'periods_as_rows' | 'days_as_rows' = 'periods_as_rows';

  if (row0Days >= 3) {
    orientation = 'periods_as_rows';
  } else if (col0Days >= 3) {
    orientation = 'days_as_rows';
  } else {
    const maxCols = Math.max(...rows.map((r) => r.length), 0);
    if (rows.length >= 8 && maxCols <= 6) {
      orientation = 'periods_as_rows';
    } else if (rows.length <= 6 && maxCols >= 8) {
      orientation = 'days_as_rows';
    }
  }

  const grid: Record<number, Record<number, TimetableCell>> = {};
  for (let d = 1; d <= 5; d++) {
    grid[d] = {};
    for (let p = 1; p <= 9; p++) {
      grid[d][p] = { cellType: 'free', subjectCode: '', label: '', instructor: '' };
    }
  }

  const parseCellContent = (text: string): TimetableCell => {
    const trimmed = text.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed === 'ว่าง' || trimmed.toLowerCase() === 'free') {
      return { cellType: 'free', subjectCode: '', label: '', instructor: '' };
    }

    const lower = trimmed.toLowerCase();
    if (/พักกลางวัน|lunch|อาหาร/.test(lower)) {
      return { cellType: 'lunch', subjectCode: '', label: 'พักกลางวัน', instructor: '' };
    }
    if (/พัก|break|recess/.test(lower)) {
      return { cellType: 'break', subjectCode: '', label: 'พัก', instructor: '' };
    }
    if (/แนะแนว|ชุมนุม|ลูกเสือ|กิจกรรม|homeroom|อบรม|จริยธรรม|club/i.test(lower)) {
      return { cellType: 'activity', subjectCode: '', label: trimmed, instructor: '' };
    }

    const lines = trimmed.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const codeMatch = trimmed.match(/([ก-๙a-zA-Z]{1,4}\s*[-]?\s*\d{3,5})/);

    let subjectCode = '';
    let label = '';
    let instructor = '';

    if (lines.length >= 2) {
      if (codeMatch && lines[0].includes(codeMatch[1])) {
        subjectCode = codeMatch[1].replace(/\s+/g, '');
        label = lines[0].replace(codeMatch[0], '').trim();
      } else {
        label = lines[0];
      }
      instructor = lines.slice(1).join(' ');
    } else {
      if (codeMatch) {
        subjectCode = codeMatch[1].replace(/\s+/g, '');
        const rest = trimmed.replace(codeMatch[0], '').replace(/[()]/g, '').trim();
        if (/ครู|อาจารย์|mr\.|ms\.|mrs\./i.test(rest)) {
          instructor = rest;
        } else {
          label = rest;
        }
      } else {
        label = trimmed;
      }
    }

    return {
      cellType: 'subject',
      subjectCode: subjectCode || label,
      label,
      instructor,
    };
  };

  if (orientation === 'periods_as_rows') {
    let dataRows = rows;
    if (row0Days >= 3 || (rows.length > 0 && rows[0].some((c) => /วัน|คาบ|day|period/i.test(c)))) {
      dataRows = rows.slice(1);
    }

    for (let rIdx = 0; rIdx < Math.min(dataRows.length, 9); rIdx++) {
      const period = rIdx + 1;
      const row = dataRows[rIdx];
      let startCol = 0;
      if (row.length > 5 && isPeriodToken(row[0])) {
        startCol = 1;
      }
      for (let cIdx = startCol; cIdx < Math.min(row.length, startCol + 5); cIdx++) {
        const day = cIdx - startCol + 1;
        if (day <= 5) {
          grid[day][period] = parseCellContent(row[cIdx] || '');
        }
      }
    }
  } else {
    let dataRows = rows;
    if (rows.length > 0 && rows[0].filter((c) => isPeriodToken(c) && /^\d+$/.test(c)).length >= 4) {
      dataRows = rows.slice(1);
    }

    for (let rIdx = 0; rIdx < Math.min(dataRows.length, 5); rIdx++) {
      const day = rIdx + 1;
      const row = dataRows[rIdx];
      let startCol = 0;
      if (row.length > 9 || isDayToken(row[0])) {
        startCol = 1;
      }
      for (let cIdx = startCol; cIdx < Math.min(row.length, startCol + 9); cIdx++) {
        const period = cIdx - startCol + 1;
        if (period <= 9) {
          grid[day][period] = parseCellContent(row[cIdx] || '');
        }
      }
    }
  }

  return grid;
}

function ImportTimetableModal({
  term,
  schoolYear,
  onClose,
  onImported,
}: {
  term: number;
  schoolYear: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'paste' | 'image'>('paste');

  // Paste mode state
  const [pasteText, setPasteText] = useState('');
  const [parsedGrid, setParsedGrid] = useState<Record<number, Record<number, TimetableCell>> | null>(null);
  const [savingPaste, setSavingPaste] = useState(false);

  // Image OCR state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('emble_gemini_key') || '');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(() => !localStorage.getItem('emble_gemini_key'));
  const [uploading, setUploading] = useState(false);
  const [permissionUrl, setPermissionUrl] = useState('');

  // Draft review state (for image upload)
  const [importDraft, setImportDraft] = useState<{ importId: string; draft: any } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    setError('');
    try {
      const grid = parseSpreadsheetText(pasteText);
      setParsedGrid(grid);
    } catch (err: any) {
      setError(err.message || 'Failed to parse timetable text');
    }
  };

  const handleTranspose = () => {
    if (!parsedGrid) return;
    const transposed: Record<number, Record<number, TimetableCell>> = {};
    for (let d = 1; d <= 5; d++) {
      transposed[d] = {};
      for (let p = 1; p <= 9; p++) {
        const source = parsedGrid[p]?.[d];
        transposed[d][p] = source || { cellType: 'free', subjectCode: '', label: '', instructor: '' };
      }
    }
    setParsedGrid(transposed);
  };

  const handleSaveParsed = async () => {
    if (!parsedGrid) return;
    setSavingPaste(true);
    setError('');
    try {
      const cells: Partial<TimetableCell>[] = [];
      for (let day = 1; day <= 5; day++) {
        for (let period = 1; period <= 9; period++) {
          const cell = parsedGrid[day]?.[period];
          if (!cell || cell.cellType === 'free') continue;
          cells.push({
            day,
            period,
            cellType: cell.cellType,
            subjectCode: cell.subjectCode || '',
            label: cell.label || '',
            instructor: cell.instructor || '',
          });
        }
      }
      await apiClient.timetable.batchUpsert(cells, term, schoolYear);
      onImported();
    } catch (err: any) {
      setError(err.message || 'Failed to save timetable');
    } finally {
      setSavingPaste(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError('');
    setPermissionUrl('');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUploadImage = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    setPermissionUrl('');

    try {
      if (geminiKey.trim()) {
        localStorage.setItem('emble_gemini_key', geminiKey.trim());
      }
      const res = await apiClient.timetable.importImage(
        selectedFile,
        term,
        schoolYear,
        geminiKey.trim() || undefined
      );
      setImportDraft(res);
    } catch (err: any) {
      const msg = err.message || '';
      setError(msg);

      if (msg.includes('Cloud Vision API has not been used') || msg.includes('vision.googleapis.com')) {
        const urlMatch = msg.match(/(https:\/\/console\.developers\.google\.com\/[^\s]+)/);
        if (urlMatch) {
          setPermissionUrl(urlMatch[1]);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDraft = async () => {
    if (!importDraft) return;
    setConfirming(true);
    setError('');
    try {
      await apiClient.timetable.confirmImport(importDraft.importId, importDraft.draft?.grid, true);
      onImported();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm timetable import');
    } finally {
      setConfirming(false);
    }
  };

  const isWide = !!parsedGrid || !!importDraft;
  const activeParsedCount = parsedGrid
    ? Object.values(parsedGrid).reduce(
        (sum, dayRow) => sum + Object.values(dayRow).filter((c) => c.cellType !== 'free').length,
        0
      )
    : 0;

  return (
    <Modal
      title={t('importTimetableTitle')}
      onClose={onClose}
      wide={isWide}
    >
      {/* Top Tab switcher when not in preview */}
      {!parsedGrid && !importDraft && (
        <div className="tabs mb-4">
          <button
            type="button"
            className={`tab ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => { setActiveTab('paste'); setError(''); }}
          >
            📋 {t('tabPasteSheets')}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => { setActiveTab('image'); setError(''); }}
          >
            📷 {t('tabUploadImage')}
          </button>
        </div>
      )}

      {/* ─── TAB 1: PASTE FROM SHEETS / EXCEL (100% FREE) ─── */}
      {activeTab === 'paste' && !parsedGrid && (
        <div className="stack gap-4">
          <div className="alert-box" style={{ background: 'var(--surface-subtle)', borderLeft: '3px solid var(--primary)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px' }}>
            <div style={{ fontWeight: 'var(--fw-medium)', marginBottom: '4px' }}>
              💡 วิธีคัดลอกจาก Google Sheets หรือ Excel (ฟรี 100% ไม่ต้องใช้ API):
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <li>เปิดตารางเรียนใน Google Sheets หรือ Excel ของคุณ</li>
              <li>ใช้เมาส์ลากคลุมตาราง (คาบ 1–9 หรือวันจันทร์–ศุกร์) แล้วกด <strong>Ctrl+C</strong> (หรือ <strong>Cmd+C</strong>)</li>
              <li>คลิกในช่องข้อความด้านล่างแล้วกด <strong>Ctrl+V</strong> (หรือ <strong>Cmd+V</strong>)</li>
            </ol>
          </div>

          <div className="field">
            <label style={{ fontSize: '12px', fontWeight: 'var(--fw-semibold)', color: 'var(--text-secondary)' }}>
              {t('pasteTimetableHint')}
            </label>
            <textarea
              className="input"
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('pastePlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre' }}
            />
          </div>

          {error && (
            <div className="field-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="cluster gap-2 justify-end mt-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!pasteText.trim()}
              onClick={handleParsePaste}
            >
              {t('parseAndPreview')} →
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 1 PREVIEW: CONFIRM PARSED SPREADSHEET ─── */}
      {activeTab === 'paste' && parsedGrid && (
        <div className="stack gap-4">
          <div className="cluster justify-between items-center text-sm">
            <span className="badge badge-info">
              พบ {activeParsedCount} คาบเรียนที่พร้อมบันทึก
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleTranspose}
              title="สลับหากตารางกลับด้านระหว่างแถวกับคอลัมน์"
            >
              🔄 สลับแถว ↔ คอลัมน์
            </button>
          </div>

          <div className="timetable-card" style={{ maxHeight: '350px' }}>
            <table className="timetable-table">
              <thead>
                <tr>
                  <th className="timetable-th timetable-period-th">{t('period')}</th>
                  {DAYS.map((d) => (
                    <th key={d} className="timetable-th">{t(DAY_KEYS[d - 1])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="timetable-td timetable-period-td">{period}</td>
                    {DAYS.map((day) => {
                      const cell = parsedGrid[day]?.[period];
                      const isFree = !cell || cell.cellType === 'free';
                      return (
                        <td key={day} className="timetable-td">
                          {isFree ? (
                            <span className="text-muted text-xs">{t('free')}</span>
                          ) : cell.cellType === 'subject' ? (
                            <div>
                              <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--primary)' }}>
                                {cell.subjectCode || cell.label}
                              </div>
                              {cell.instructor && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cell.instructor}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>
                              {cell.label || cell.cellType}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="field-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="cluster gap-2 justify-between items-center mt-4">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setParsedGrid(null)}
              disabled={savingPaste}
            >
              ← แก้ไขข้อความที่วาง
            </button>

            <div className="cluster gap-2">
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={savingPaste}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveParsed}
                disabled={savingPaste}
              >
                {savingPaste ? <div className="spinner" /> : 'บันทึกตารางเรียนลงระบบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: UPLOAD IMAGE VIA AI OCR ─── */}
      {activeTab === 'image' && !importDraft && (
        <div className="stack gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <div
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Timetable preview" className="upload-preview-img" />
            ) : (
              <>
                <Icon name="upload" size={36} className="text-muted" />
                <div style={{ fontWeight: 'var(--fw-medium)' }}>
                  {t('uploadTimetableImage')}
                </div>
                <div className="text-muted text-xs">
                  JPEG, PNG, WEBP (Max 10MB)
                </div>
              </>
            )}
          </div>

          {selectedFile && (
            <div className="cluster justify-between items-center text-sm text-muted">
              <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </button>
            </div>
          )}

          {/* Gemini API Key Box (Free) */}
          <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div className="cluster justify-between items-center">
              <label style={{ fontSize: '12px', fontWeight: 'var(--fw-semibold)' }}>
                🔑 {t('geminiApiKeyLabel')}
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={() => setShowKeyInput(!showKeyInput)}
              >
                {showKeyInput ? 'ซ่อน' : (geminiKey ? 'แก้ไขคีย์' : '+ ใส่ API Key')}
              </button>
            </div>

            {showKeyInput && (
              <div className="stack gap-2 mt-2">
                <input
                  className="input text-xs"
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={t('geminiKeyPlaceholder')}
                />
                <div className="text-muted text-xs">
                  {t('geminiKeyHelp')} —{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                  >
                    รับ API Key ฟรีที่ Google AI Studio →
                  </a>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="field-error stack gap-2" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
              <div className="cluster gap-2 items-center">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
              {permissionUrl && (
                <div className="mt-2 text-xs">
                  Google Cloud Vision API เรียกเก็บเงิน หากต้องการฟรี 100% แนะนำใช้แถบ <strong>"วางจาก Sheets / Excel"</strong> ด้านบน หรือใส่คีย์ฟรีจาก <strong>aistudio.google.com</strong>
                </div>
              )}
            </div>
          )}

          <div className="cluster gap-2 justify-end mt-4">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedFile || uploading}
              onClick={handleUploadImage}
            >
              {uploading ? (
                <>
                  <div className="spinner" />
                  <span>{t('analyzingImage')}</span>
                </>
              ) : (
                <span>สแกนตารางเรียนด้วย AI</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2 PREVIEW: CONFIRM OCR DRAFT ─── */}
      {activeTab === 'image' && importDraft && (
        <div className="stack gap-4">
          <div className="text-sm text-secondary">
            ตรวจพบ {importDraft.draft?.blockCount || 0} รายการ (ความแม่นยำ: {((importDraft.draft?.ocrConfidence || 0) * 100).toFixed(0)}%). ตรวจสอบก่อนบันทึก:
          </div>

          <div className="timetable-card" style={{ maxHeight: '350px' }}>
            <table className="timetable-table">
              <thead>
                <tr>
                  <th className="timetable-th timetable-period-th">{t('period')}</th>
                  {DAYS.map((d) => (
                    <th key={d} className="timetable-th">{t(DAY_KEYS[d - 1])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="timetable-td timetable-period-td">{period}</td>
                    {DAYS.map((day) => {
                      const cell = importDraft.draft?.grid?.[day]?.[period];
                      return (
                        <td key={day} className="timetable-td">
                          {cell?.cellType === 'subject' ? (
                            <span className="badge badge-info">{cell.subjectCode || cell.label || '-'}</span>
                          ) : (
                            <span className="text-muted text-xs">{cell?.label || cell?.cellType || 'free'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="field-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="cluster gap-2 justify-end mt-4">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setImportDraft(null)}
              disabled={confirming}
            >
              Re-upload
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmDraft}
              disabled={confirming}
            >
              {confirming ? <div className="spinner" /> : t('confirmImport')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
