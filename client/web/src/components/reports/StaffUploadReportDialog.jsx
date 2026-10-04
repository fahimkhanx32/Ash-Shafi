import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  User,
  Stethoscope,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Search,
} from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as reportsService from '../../services/reportsService.js';
import * as staffService from '../../services/staffService.js';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { DOCUMENT_TYPE_CATALOG } from '../../constants/reports.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1 block';

export default function StaffUploadReportDialog({
  open,
  onOpenChange,
  preselectedPatientProfileId = null,
  preselectedPatientName = '',
  onUploaded,
  initialFile = null,
}) {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  // Patient Selection
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientProfileId || '');
  const [selectedPatientDisplay, setSelectedPatientDisplay] = useState(preselectedPatientName || '');
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Doctor Selection
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [targetDoctorId, setTargetDoctorId] = useState('');

  // Report fields
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('CBC');
  const [customTitle, setCustomTitle] = useState('Complete Blood Count (CBC)');
  const [patientNote, setPatientNote] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [performingFacility, setPerformingFacility] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setConfirmed(false);
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedPatientId(preselectedPatientProfileId || '');
      setSelectedPatientDisplay(preselectedPatientName || '');
      setPatientSearch('');
      setSelectedDocType('CBC');
      setCustomTitle('Complete Blood Count (CBC)');
      setPatientNote('');
      setPerformingFacility('');
      setReportDate(new Date().toISOString().slice(0, 10));
      if (fileRef.current) fileRef.current.value = '';

      setLoadingDoctors(true);
      staffService
        .listDoctors({ limit: 50 })
        .then((res) => {
          const activeDocs = (res.items || []).filter(
            (d) => d.user?.status === 'ACTIVE' || d.employmentStatus === 'ACTIVE',
          );
          setDoctors(activeDocs);
          // Intentionally NOT pre-selecting a doctor: the recipient is
          // optional for staff, and a silent default would send the report
          // (and a notification) to someone nobody chose.
        })
        .catch(() => {})
        .finally(() => setLoadingDoctors(false));
    }
  }, [open, preselectedPatientProfileId, preselectedPatientName]);

  // Search patients if not preselected
  useEffect(() => {
    if (!preselectedPatientProfileId && patientSearch.trim().length >= 2) {
      const timer = setTimeout(() => {
        setSearchingPatients(true);
        patientsService
          .listPatients({ search: patientSearch.trim(), limit: 10 })
          .then((res) => setPatients(res.items || []))
          .catch(() => {})
          .finally(() => setSearchingPatients(false));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [patientSearch, preselectedPatientProfileId]);

  const handleDocTypeChange = (e) => {
    const docId = e.target.value;
    setSelectedDocType(docId);
    const item = DOCUMENT_TYPE_CATALOG.find((d) => d.id === docId);
    if (item) {
      setCustomTitle(item.name);
    }
  };

  const [dragging, setDragging] = useState(false);

  const handleFileChange = (e) => acceptFile(e.target.files?.[0]);

  const acceptFile = (picked) => {
    if (!picked) return;

    const okExt = /\.(jpe?g|png|webp|pdf|docx|xlsx)$/i.test(picked.name || '');
    if (!okExt) {
      setError('Unsupported file. Use PDF, JPG, PNG, WebP, DOCX or XLSX.');
      return;
    }

    if (picked.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25MB limit.');
      return;
    }

    setError('');
    setFile(picked);

    if (picked.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(picked));
    } else {
      setPreviewUrl(null);
    }
  };

  // A file dropped on the page behind the dialog arrives pre-selected.
  useEffect(() => {
    if (open && initialFile) acceptFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPatientId) {
      setError('Please select a patient.');
      return;
    }

    if (!file) {
      setError('Please choose a report document to upload.');
      return;
    }

    if (!customTitle.trim()) {
      setError('A report title is required.');
      return;
    }

    const docMeta = DOCUMENT_TYPE_CATALOG.find((d) => d.id === selectedDocType);
    const reportType = docMeta?.category || 'LABORATORY';

    setSaving(true);

    try {
      const result = await reportsService.submitIntakeReport(file, {
        patientProfileId: selectedPatientId,
        reportType,
        title: customTitle.trim(),
        targetDoctorId: targetDoctorId || undefined,
        patientNote: patientNote.trim() || undefined,
        reportDate: reportDate || undefined,
        performingFacility: performingFacility.trim() || undefined,
      });

      setConfirmed(true);
      onUploaded?.(result);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const targetDocObj = doctors.find((d) => (d.user?.id || d.id) === targetDoctorId);
  const targetDocName =
    targetDocObj?.user?.name ||
    [targetDocObj?.firstName, targetDocObj?.lastName].filter(Boolean).join(' ') ||
    'Assigned Doctor';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      className="max-w-xl"
    >
      <DialogCloseButton onClose={() => !saving && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base font-bold">
          <Upload className="text-primary" size={18} />
          Upload Medical Document for Patient
        </DialogTitle>
        <DialogDescription>
          Attach a document to a patient's chart. Recorded with your staff identity and sent to the
          doctor's intake inbox.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {confirmed ? (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Document Uploaded Successfully!</h3>
            <p className="text-xs text-muted-foreground">
              Document <span className="font-semibold text-foreground">"{customTitle}"</span> has
              been uploaded for patient{' '}
              <span className="font-semibold text-foreground">{selectedPatientDisplay || 'the patient'}</span>{' '}
              and routed to <span className="font-semibold text-foreground">Dr. {targetDocName}</span>.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3.5">
          {/* Patient Selector */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <User size={13} className="text-primary" />
                Select Patient *
              </span>
            </label>
            {preselectedPatientProfileId ? (
              <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{selectedPatientDisplay || 'Selected Patient'}</span>
                <Badge variant="outline">Locked</Badge>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    className={`${inputClass} pl-8`}
                    placeholder="Search patient by name or ID (min 2 chars)..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {searchingPatients && (
                    <Spinner size={13} className="absolute right-3 top-3 text-muted-foreground" />
                  )}
                </div>
                {patients.length > 0 && !selectedPatientId && (
                  <div className="rounded-lg border border-border bg-card max-h-36 overflow-y-auto divide-y divide-border">
                    {patients.map((p) => {
                      const pName = p.fullName || `${p.firstName} ${p.lastName}`;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full p-2 text-left hover:bg-muted/50 text-xs flex items-center justify-between"
                          onClick={() => {
                            setSelectedPatientId(p.id);
                            setSelectedPatientDisplay(`${pName} (${p.patientId})`);
                            setPatients([]);
                          }}
                        >
                          <span className="font-medium text-foreground">{pName}</span>
                          <span className="font-mono text-muted-foreground">{p.patientId}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedPatientId && (
                  <div className="p-2 rounded-lg border border-primary/30 bg-primary/5 text-xs flex items-center justify-between">
                    <span className="font-semibold text-foreground">{selectedPatientDisplay}</span>
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => {
                        setSelectedPatientId('');
                        setSelectedPatientDisplay('');
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Target Doctor */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Stethoscope size={13} className="text-primary" />
                Target Doctor to Review *
              </span>
            </label>
            {loadingDoctors ? (
              <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner size={14} /> Loading doctors...
              </div>
            ) : (
              <select
                className={inputClass}
                value={targetDoctorId}
                disabled={saving}
                onChange={(e) => setTargetDoctorId(e.target.value)}
                required
              >
                <option value="">-- Choose target doctor --</option>
                {doctors.map((d) => {
                  const docId = d.user?.id || d.id;
                  const name =
                    d.user?.name || [d.firstName, d.lastName].filter(Boolean).join(' ');
                  const dept = d.department?.name ? ` (${d.department.name})` : '';
                  return (
                    <option key={docId} value={docId}>
                      Dr. {name}
                      {dept}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Document Type & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Document Type *</label>
              <select
                className={inputClass}
                value={selectedDocType}
                disabled={saving}
                onChange={handleDocTypeChange}
              >
                {DOCUMENT_TYPE_CATALOG.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} [{doc.sub}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Document Title *</label>
              <input
                className={inputClass}
                value={customTitle}
                disabled={saving}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Chest X-Ray, Blood Report"
                maxLength={200}
                required
              />
            </div>
          </div>

          {/* File Picker */}
          <div>
            <label className={labelClass}>Report File (PDF, JPG, PNG, WebP, DOCX) *</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!saving) acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={`p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
                dragging
                  ? 'border-primary bg-primary/10'
                  : file
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-primary/40 bg-muted/20'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx"
                disabled={saving}
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="text-primary shrink-0" size={20} />
                  <span className="text-xs font-semibold truncate text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <Upload className="mx-auto text-muted-foreground" size={20} />
                  <p className="text-xs font-medium text-foreground">Drag &amp; drop a file here, or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Report Date & Facility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Report Date</label>
              <input
                type="date"
                className={inputClass}
                value={reportDate}
                disabled={saving}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Performing Facility</label>
              <input
                className={inputClass}
                value={performingFacility}
                disabled={saving}
                onChange={(e) => setPerformingFacility(e.target.value)}
                placeholder="Diagnostic center name"
                maxLength={200}
              />
            </div>
          </div>

          {/* Staff Note */}
          <div>
            <label className={labelClass}>Clinical / Staff Note (Optional)</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
              value={patientNote}
              disabled={saving}
              onChange={(e) => setPatientNote(e.target.value)}
              placeholder="e.g. Brought by patient at reception"
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !file || !selectedPatientId || !targetDoctorId}
              className="gap-1.5"
            >
              {saving ? (
                <>
                  <Spinner size={14} /> Uploading...
                </>
              ) : (
                <>
                  <Upload size={14} /> Upload for Patient
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
