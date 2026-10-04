import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Info,
  Clock,
  Sparkles,
  Eye,
  FileCheck2,
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
import { extractApiError } from '../../services/apiClient.js';
import { DOCUMENT_TYPE_CATALOG } from '../../constants/reports.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';
const labelClass = 'text-xs font-semibold text-muted-foreground mb-1 block';

export default function PatientUploadReportDialog({ open, onOpenChange, onSubmitted, onUploaded, initialFile = null }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorsError, setDoctorsError] = useState('');

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedDocType, setSelectedDocType] = useState('CBC');
  const [customTitle, setCustomTitle] = useState('Complete Blood Count (CBC)');
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [patientNote, setPatientNote] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [performingFacility, setPerformingFacility] = useState('');

  // Submission / OCR stages: 'form' | 'submitting' | 'processing' | 'confirmed'
  const [stage, setStage] = useState('form');
  const [ocrStatus, setOcrStatus] = useState('idle'); // 'idle' | 'reading' | 'completed' | 'failed'
  const [submissionResult, setSubmissionResult] = useState(null);
  const [error, setError] = useState('');

  // Load active doctors
  useEffect(() => {
    if (open) {
      setLoadingDoctors(true);
      setDoctorsError('');
      staffService
        .listDoctors({ limit: 50 })
        .then((res) => {
          // Patients get a narrow directory entry ({ userId, name, ... }) that
          // the server has already limited to active doctors; staff-shaped
          // entries ({ user, employmentStatus }) are still handled.
          const activeDocs = (res.items || []).filter(
            (d) =>
              d.userId ||
              d.user?.status === 'ACTIVE' ||
              d.employmentStatus === 'ACTIVE',
          );
          setDoctors(activeDocs);
          // No pre-selection: the patient must consciously choose a recipient.
          // (Pre-selecting the first doctor could route a report to someone
          // the patient never picked.)
        })
        .catch((err) => setDoctorsError(extractApiError(err).message))
        .finally(() => setLoadingDoctors(false));
    }
  }, [open]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setError('');
      setStage('form');
      setOcrStatus('idle');
      setSubmissionResult(null);
      setSelectedDocType('CBC');
      setCustomTitle('Complete Blood Count (CBC)');
      setPatientNote('');
      setPerformingFacility('');
      setReportDate(new Date().toISOString().slice(0, 10));
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open]);

  // A file dropped on the Reports tab arrives pre-selected.
  useEffect(() => {
    if (open && initialFile) acceptFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const handleDocTypeChange = (e) => {
    const docId = e.target.value;
    setSelectedDocType(docId);
    const item = DOCUMENT_TYPE_CATALOG.find((d) => d.id === docId);
    if (item) {
      setCustomTitle(item.name);
    }
  };

  const handleFileChange = (e) => acceptFile(e.target.files?.[0]);

  const acceptFile = (picked) => {
    if (!picked) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(picked.mimetype || picked.type)) {
      setError('Please upload a photo (JPG, PNG, WebP) or a PDF file of your report.');
      return;
    }

    if (picked.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25MB limit.');
      return;
    }

    setError('');
    setFile(picked);

    if (picked.type.startsWith('image/')) {
      const url = URL.createObjectURL(picked);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Poll the report for up to ~45s so the patient sees whether text
  // extraction really finished, failed, or is still running.
  const pollOcr = async (reportId) => {
    if (!reportId) return;
    for (let i = 0; i < 15; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const r = await reportsService.getReport(reportId);
        const st = r?.extraction?.status;
        if (st === 'COMPLETED') return setOcrStatus('completed');
        if (st === 'FAILED') return setOcrStatus('failed');
      } catch {
        return undefined; // the upload is safe either way; stop polling
      }
    }
    return undefined;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please choose a report document or image to upload.');
      return;
    }

    if (!customTitle.trim()) {
      setError('A report title is required.');
      return;
    }

    const docMeta = DOCUMENT_TYPE_CATALOG.find((d) => d.id === selectedDocType);
    const reportType = docMeta?.category || 'LABORATORY';

    setStage('submitting');
    setOcrStatus('reading');

    try {
      const result = await reportsService.submitIntakeReport(file, {
        reportType,
        title: customTitle.trim(),
        targetDoctorId: targetDoctorId || undefined,
        patientNote: patientNote.trim() || undefined,
        reportDate: reportDate || undefined,
        performingFacility: performingFacility.trim() || undefined,
      });

      setSubmissionResult(result);
      // The upload itself succeeded; OCR runs afterwards on the server, so
      // report its real state rather than assuming success.
      setOcrStatus(result.report?.extraction?.status === 'COMPLETED' ? 'completed' : 'running');
      setStage('confirmed');
      onSubmitted?.(result);
      onUploaded?.(result);
      pollOcr(result.report?.id);
    } catch (err) {
      const apiErr = extractApiError(err);
      setError(apiErr.message);
      setStage('form');
      setOcrStatus('idle');
    }
  };

  const targetDocObj = doctors.find(
    (d) => (d.userId || d.user?.id || d.id) === targetDoctorId,
  );
  const targetDocName =
    targetDocObj?.name ||
    targetDocObj?.user?.name ||
    [targetDocObj?.firstName, targetDocObj?.lastName].filter(Boolean).join(' ') ||
    'Selected Doctor';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => stage !== 'submitting' && onOpenChange(next)}
      className="max-w-xl"
    >
      <DialogCloseButton onClose={() => stage !== 'submitting' && onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
          <Upload className="text-primary" size={20} />
          {t('clinical.intake.uploadTitle', 'Send Medical Report to Doctor')}
        </DialogTitle>
        <DialogDescription>
          {t(
            'clinical.intake.uploadDescription',
            'Upload your lab tests, imaging, or prescriptions. Documents are processed with OCR and securely shared with your chosen doctor.',
          )}
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stage === 'confirmed' ? (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="font-bold text-base text-foreground">
              Report Submitted Successfully!
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Your report <span className="font-semibold text-foreground">"{customTitle}"</span> has
              been submitted and routed to{' '}
              <span className="font-semibold text-foreground">Dr. {targetDocName}</span>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-card text-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Report Type:</span>
              <Badge variant="outline">{selectedDocType}</Badge>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Recipient Doctor:</span>
              <span className="font-semibold text-foreground">Dr. {targetDocName}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Document File:</span>
              <span className="font-mono">{file?.name}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>OCR Status:</span>
              {ocrStatus === 'completed' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Sparkles size={13} /> Text extracted (unverified)
                </span>
              ) : ocrStatus === 'failed' ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Text extraction failed — your doctor can still open the original file
                </span>
              ) : (
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Spinner size={12} /> Reading text…
                </span>
              )}
            </div>
          </div>

          <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-xs font-bold uppercase tracking-wider">
              Clinical Review Notice
            </AlertTitle>
            <AlertDescription className="text-xs">
              Automated OCR extracts document text for convenience. This is machine-extracted
              data and must be reviewed and verified by your doctor before being treated as clinical
              records.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Target Doctor Selector */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <Stethoscope size={14} className="text-primary" />
                Select Doctor to Share Report With *
              </span>
            </label>
            {loadingDoctors ? (
              <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner size={14} /> Loading available doctors...
              </div>
            ) : doctorsError || doctors.length === 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                {doctorsError
                  ? `Couldn't load the doctor list: ${doctorsError}`
                  : 'No doctors are available to receive reports yet. Ask the clinic to register an active doctor account.'}
              </div>
            ) : (
              <select
                className={inputClass}
                value={targetDoctorId}
                disabled={stage === 'submitting'}
                onChange={(e) => setTargetDoctorId(e.target.value)}
                required
              >
                <option value="">-- Choose a doctor --</option>
                {doctors.map((d) => {
                  const docId = d.userId || d.user?.id || d.id;
                  const name =
                    d.name || d.user?.name || [d.firstName, d.lastName].filter(Boolean).join(' ');
                  const dept = d.department?.name ? ` (${d.department.name})` : '';
                  const desig = d.designation || d.specialization ? ` - ${d.designation || d.specialization}` : '';
                  return (
                    <option key={docId} value={docId}>
                      Dr. {name}
                      {desig}
                      {dept}
                    </option>
                  );
                })}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Your report will be delivered directly to this doctor's intake inbox and conversation.
            </p>
          </div>

          {/* Document / Report Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Document / Report Type *</label>
              <select
                className={inputClass}
                value={selectedDocType}
                disabled={stage === 'submitting'}
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
              <label className={labelClass}>Report Title *</label>
              <input
                className={inputClass}
                value={customTitle}
                disabled={stage === 'submitting'}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Blood Test, Chest X-Ray"
                maxLength={200}
                required
              />
            </div>
          </div>

          {/* File Picker & Preview */}
          <div>
            <label className={labelClass}>Report Document / Photo (JPG, PNG, WebP, PDF) *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
                file
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-primary/40 bg-muted/20'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                disabled={stage === 'submitting'}
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  {file.type.startsWith('image/') ? (
                    <ImageIcon className="text-primary shrink-0" size={24} />
                  ) : (
                    <FileText className="text-primary shrink-0" size={24} />
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Click to choose another file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto text-muted-foreground" size={24} />
                  <p className="text-xs font-medium text-foreground">
                    Click to select file or drag photo/PDF here
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    JPG, PNG, WebP, or scanned PDF up to 25MB
                  </p>
                </div>
              )}
            </div>

            {/* Thumbnail Preview */}
            {previewUrl && (
              <div className="mt-2 relative rounded-lg border border-border overflow-hidden bg-black/5 max-h-40 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Report Preview"
                  className="max-h-40 object-contain mx-auto"
                />
              </div>
            )}
          </div>

          {/* Optional Report Date & Facility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Report / Test Date</label>
              <input
                type="date"
                className={inputClass}
                value={reportDate}
                disabled={stage === 'submitting'}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Laboratory / Diagnostic Center</label>
              <input
                className={inputClass}
                value={performingFacility}
                disabled={stage === 'submitting'}
                onChange={(e) => setPerformingFacility(e.target.value)}
                placeholder="e.g. Popular Diagnostic, Ibn Sina"
                maxLength={200}
              />
            </div>
          </div>

          {/* Patient Note */}
          <div>
            <label className={labelClass}>Note for Doctor (Optional)</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
              value={patientNote}
              disabled={stage === 'submitting'}
              onChange={(e) => setPatientNote(e.target.value)}
              placeholder="e.g. Uploading my recent blood test for tomorrow's follow-up."
              maxLength={500}
            />
          </div>

          {/* OCR & Medical Safety Info Box */}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Sparkles className="text-primary shrink-0 mt-0.5" size={15} />
            <div>
              <span className="font-semibold text-foreground">
                Automatic OCR & Doctor Notification:
              </span>{' '}
              When you submit, text is extracted automatically from your document and your selected
              doctor is notified in their intake inbox.
            </div>
          </div>

          {/* Uploading progress indicator */}
          {stage === 'submitting' && (
            <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-center gap-3 text-xs">
              <Spinner size={16} />
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">
                  {ocrStatus === 'reading' ? 'Reading document with OCR...' : 'Uploading document...'}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Saving original file and extracting text parameters...
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={stage === 'submitting'}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={stage === 'submitting' || !file || !targetDoctorId}
              className="gap-2"
            >
              {stage === 'submitting' ? (
                <>
                  <Spinner size={14} /> Submitting Report...
                </>
              ) : (
                <>
                  <Upload size={14} /> Submit to Doctor
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
