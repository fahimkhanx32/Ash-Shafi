import { useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldCheck,
  Clock,
  User,
  Stethoscope,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { Skeleton } from '../ui/skeleton.jsx';
import { Spinner } from '../ui/spinner.jsx';
import * as reportsService from '../../services/reportsService.js';
import { extractApiError } from '../../services/apiClient.js';
import {
  reportStatusLabel,
  reportStatusVariant,
  reportTypeLabel,
  abnormalFlagLabel,
  abnormalFlagVariant,
  intakeStatusLabel,
  intakeStatusVariant,
} from '../../constants/reports.js';
import { formatDate, formatRelativeTime } from '../../lib/dateFormat.js';

const labelClass = 'text-xs font-semibold text-muted-foreground mb-1 block';
const inputClass = 'w-full h-8 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60';
const textareaClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function ReportDetailDialog({
  open,
  onOpenChange,
  reportId,
  canWrite = false,
  canVerify = false,
  onChanged,
}) {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  // Active view tab: 'results' | 'document' | 'raw_ocr' | 'history'
  const [activeTab, setActiveTab] = useState('results');

  // Document preview state
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Clinical verification states
  const [interpretation, setInterpretation] = useState('');
  const [reason, setReason] = useState('');
  const [amendMode, setAmendMode] = useState(false);
  const [correcting, setCorrecting] = useState(null);
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Intake Accept / Reject
  const [intakeReviewNote, setIntakeReviewNote] = useState('');
  const [intakeReviewMode, setIntakeReviewMode] = useState(null); // 'ACCEPT' | 'REJECT' | null

  const load = () => {
    if (!reportId) return;
    setState('loading');
    reportsService
      .getReport(reportId)
      .then((data) => {
        setReport(data);
        setInterpretation(data.interpretation || '');
        setState('ready');
      })
      .catch((err) => {
        setError(extractApiError(err).message);
        setState('error');
      });
  };

  useEffect(() => {
    if (open && reportId) {
      setError('');
      setReason('');
      setAmendMode(false);
      setCorrecting(null);
      setIntakeReviewMode(null);
      setIntakeReviewNote('');
      setActiveTab('results');
      setZoomLevel(1);
      load();
    }
  }, [open, reportId]);

  // Load document preview blob when document tab is opened
  useEffect(() => {
    if (open && report && activeTab === 'document' && !previewBlobUrl) {
      setLoadingPreview(true);
      reportsService
        .getReportDownloadUrl(report.id || report._id)
        .then((url) => setPreviewBlobUrl(url))
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    }
  }, [open, report, activeTab, previewBlobUrl]);

  // Clean up blob URL on close
  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const runAction = async (action) => {
    setActing(true);
    setError('');
    try {
      const updated = await action();
      setReport(updated);
      setInterpretation(updated.interpretation || '');
      onChanged?.(updated);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setActing(false);
    }
  };

  const handleDownload = async () => {
    setActing(true);
    setError('');
    try {
      const url = await reportsService.getReportDownloadUrl(report.id || report._id);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.originalDocument?.originalFilename || `Report_${report.reportReference}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setActing(false);
    }
  };

  const handleIntakeReviewSubmit = async (decision) => {
    if (decision === 'REJECT' && intakeReviewNote.trim().length < 3) {
      setError('A rejection reason of at least 3 characters is required.');
      return;
    }
    await runAction(() =>
      reportsService.reviewIntake(report.id || report._id, {
        decision,
        note: intakeReviewNote.trim(),
      }),
    );
    setIntakeReviewMode(null);
  };

  const reviewableStatus = report && ['EXTRACTED', 'NEEDS_REVIEW'].includes(report.status);
  const parameters = report?.parameters || [];
  const isPendingIntake = report?.submission?.intakeStatus === 'PENDING_REVIEW';
  const isImageFile = report?.originalDocument?.mimeType?.startsWith('image/');
  const isPdfFile = report?.originalDocument?.mimeType === 'application/pdf';

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !acting && onOpenChange(next)}
      className="max-w-4xl"
    >
      <DialogCloseButton onClose={() => !acting && onOpenChange(false)} />
      <DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <FileText className="text-primary" size={20} />
              {report?.title || 'Medical Report'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ref: <span className="font-mono font-medium text-foreground">{report?.reportReference}</span> •{' '}
              {report?.reportType ? reportTypeLabel(report.reportType, t) : ''}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            {report?.submission?.intakeStatus && (
              <Badge variant={intakeStatusVariant(report.submission.intakeStatus)}>
                {intakeStatusLabel(report.submission.intakeStatus, t)}
              </Badge>
            )}
            <Badge variant={reportStatusVariant(report?.status)}>
              {report?.status ? reportStatusLabel(report.status, t) : 'Loading...'}
            </Badge>
          </div>
        </div>
      </DialogHeader>

      {state === 'loading' ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state === 'error' ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error Loading Report</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : report ? (
        <div className="mt-3 space-y-4 max-h-[72vh] overflow-y-auto pr-1">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* Patient & Report Metadata Header */}
          <div className="p-3.5 rounded-xl border border-border bg-muted/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Patient:</span>
              <span className="font-semibold text-foreground">
                {report.patientProfile?.firstName} {report.patientProfile?.lastName}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground block">
                {report.patientProfile?.patientId}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Upload Source:</span>
              <span className="font-medium text-foreground">
                {report.submission?.source === 'PATIENT_SUBMITTED'
                  ? 'Patient Submission'
                  : report.submission?.source === 'STAFF_ON_BEHALF'
                  ? 'Staff on Behalf'
                  : 'Clinic Staff'}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {report.submission?.uploadedByRole || 'STAFF'}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Target Doctor:</span>
              <span className="font-medium text-foreground">
                {report.submission?.targetDoctor?.name
                  ? `Dr. ${report.submission.targetDoctor.name}`
                  : 'Assigned Provider'}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {formatDate(report.uploadDate)}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Verification:</span>
              <span className="font-semibold text-foreground">
                {report.verification?.status || 'NOT_STARTED'}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {report.performingFacility || 'Local Clinic'}
              </span>
            </div>
          </div>

          {/* Intake Review Alert for Routed Doctors */}
          {canVerify && isPendingIntake && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
                <div className="text-xs">
                  <p className="font-bold text-foreground">Incoming Patient Submission Pending Review</p>
                  <p className="text-muted-foreground">
                    Please review this document to decide if it belongs in the patient's official chart.
                  </p>
                </div>
              </div>

              {!intakeReviewMode ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                    disabled={acting}
                    onClick={() => {
                      setIntakeReviewMode('ACCEPT');
                      setIntakeReviewNote('Accepted into patient chart');
                    }}
                  >
                    <CheckCircle2 size={13} /> Accept into Chart
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 gap-1 text-xs"
                    disabled={acting}
                    onClick={() => {
                      setIntakeReviewMode('REJECT');
                      setIntakeReviewNote('');
                    }}
                  >
                    <XCircle size={13} /> Reject Submission
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {/* Intake Accept / Reject Form Inline */}
          {intakeReviewMode && (
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5 text-xs">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                {intakeReviewMode === 'ACCEPT' ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-500" /> Confirm Acceptance
                  </>
                ) : (
                  <>
                    <XCircle size={15} className="text-destructive" /> Provide Rejection Reason
                  </>
                )}
              </div>
              <textarea
                rows={2}
                className={textareaClass}
                placeholder={
                  intakeReviewMode === 'REJECT'
                    ? 'Reason for rejection (e.g. illegible scan, wrong patient name)...'
                    : 'Optional acceptance note...'
                }
                value={intakeReviewNote}
                onChange={(e) => setIntakeReviewNote(e.target.value)}
                maxLength={500}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting}
                  onClick={() => setIntakeReviewMode(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant={intakeReviewMode === 'ACCEPT' ? 'default' : 'destructive'}
                  disabled={acting || (intakeReviewMode === 'REJECT' && intakeReviewNote.trim().length < 3)}
                  onClick={() => handleIntakeReviewSubmit(intakeReviewMode)}
                >
                  Confirm {intakeReviewMode === 'ACCEPT' ? 'Acceptance' : 'Rejection'}
                </Button>
              </div>
            </div>
          )}

          {/* View Mode Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'results'
                  ? 'bg-accent text-accent-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles size={14} className="text-primary" />
              OCR Extracted Results ({parameters.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('document')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'document'
                  ? 'bg-accent text-accent-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye size={14} />
              Original Document Preview
            </button>

            {report.extraction?.extractedText && (
              <button
                type="button"
                onClick={() => setActiveTab('raw_ocr')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'raw_ocr'
                    ? 'bg-accent text-accent-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText size={14} />
                Raw Machine Text
              </button>
            )}
          </div>

          {/* TAB 1: Structured Results & Verification */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {/* Critical Notice: Machine Extracted */}
              <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
                <Sparkles className="text-sky-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <span className="font-bold">Machine Extracted Data:</span> Extracted by automated
                  OCR text parser. Machine data is NOT verified clinical information until an
                  authorized physician verifies or corrects each value.
                </div>
              </div>

              {parameters.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                      <tr>
                        <th className="p-2.5">Test Parameter</th>
                        <th className="p-2.5">Extracted Value</th>
                        <th className="p-2.5">Reference Range</th>
                        <th className="p-2.5">Flag</th>
                        <th className="p-2.5">Verification Status</th>
                        {canVerify && reviewableStatus && <th className="p-2.5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parameters.map((param) => {
                        const paramId = param.id || param._id;
                        const isCorrectingThis = correcting === paramId;
                        const vStatus = param.verification?.status || 'PENDING';

                        return (
                          <tr key={paramId} className="hover:bg-muted/20 align-top">
                            <td className="p-2.5 font-medium text-foreground">
                              {param.name}
                              {param.extraction?.sourceLine && (
                                <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
                                  Raw: {param.extraction.sourceLine}
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 font-semibold text-foreground">
                              {isCorrectingThis ? (
                                <div className="space-y-1">
                                  <input
                                    className={inputClass}
                                    value={correctionValue}
                                    disabled={acting}
                                    onChange={(e) => setCorrectionValue(e.target.value)}
                                    placeholder="Corrected value"
                                  />
                                  <input
                                    className={inputClass}
                                    value={correctionReason}
                                    disabled={acting}
                                    onChange={(e) => setCorrectionReason(e.target.value)}
                                    placeholder="Reason for correction"
                                  />
                                </div>
                              ) : (
                                <span>
                                  {param.value} {param.unit || ''}
                                </span>
                              )}
                            </td>

                            <td className="p-2.5 text-muted-foreground">
                              {param.referenceRange || '—'}
                            </td>

                            <td className="p-2.5">
                              <Badge variant={abnormalFlagVariant(param.abnormalFlag)}>
                                {abnormalFlagLabel(param.abnormalFlag, t)}
                              </Badge>
                            </td>

                            <td className="p-2.5">
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-block ${
                                  vStatus === 'CONFIRMED'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : vStatus === 'CORRECTED'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                    : vStatus === 'REJECTED'
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {vStatus === 'PENDING'
                                  ? 'Machine Extracted'
                                  : vStatus === 'CONFIRMED'
                                  ? 'Doctor Confirmed'
                                  : vStatus === 'CORRECTED'
                                  ? 'Doctor Corrected'
                                  : 'Rejected'}
                              </span>
                            </td>

                            {canVerify && reviewableStatus && (
                              <td className="p-2.5 text-right whitespace-nowrap">
                                {isCorrectingThis ? (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs px-2"
                                      disabled={acting || !correctionValue.trim()}
                                      onClick={() =>
                                        runAction(() =>
                                          reportsService.reviewParameter(report.id || report._id, paramId, {
                                            action: 'CORRECT',
                                            correctedValue: correctionValue,
                                            reason: correctionReason,
                                          }),
                                        ).then(() => setCorrecting(null))
                                      }
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2"
                                      disabled={acting}
                                      onClick={() => setCorrecting(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
                                      disabled={acting}
                                      onClick={() =>
                                        runAction(() =>
                                          reportsService.reviewParameter(report.id || report._id, paramId, {
                                            action: 'CONFIRM',
                                          }),
                                        )
                                      }
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2 text-blue-700 dark:text-blue-400 hover:bg-blue-50"
                                      disabled={acting}
                                      onClick={() => {
                                        setCorrecting(paramId);
                                        setCorrectionValue(param.value || '');
                                        setCorrectionReason('');
                                      }}
                                    >
                                      Correct
                                    </Button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-border bg-card text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">No tabular test parameters parsed</p>
                  <p>
                    This document may be an image, scan, or narrative report without standard
                    tabular values. You can view the original document or raw OCR text in the tabs above.
                  </p>
                </div>
              )}

              {/* Doctor Clinical Interpretation Box */}
              {canVerify && ['EXTRACTED', 'NEEDS_REVIEW', 'VERIFIED'].includes(report.status) ? (
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                  <label className={labelClass}>Physician Clinical Interpretation & Notes</label>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    value={interpretation}
                    disabled={acting}
                    onChange={(e) => setInterpretation(e.target.value)}
                    placeholder="Enter diagnostic assessment, clinical summary, or follow-up recommendations..."
                    maxLength={3000}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      disabled={acting || !interpretation.trim()}
                      onClick={() =>
                        runAction(() =>
                          reportsService.setInterpretation(report.id || report._id, interpretation),
                        )
                      }
                    >
                      Save Interpretation
                    </Button>
                  </div>
                </div>
              ) : report.interpretation ? (
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <div className={labelClass}>Physician Clinical Interpretation</div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{report.interpretation}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: Original Document Preview & Zoom */}
          {activeTab === 'document' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border text-xs">
                <span className="font-medium text-foreground">
                  {report.originalDocument?.originalFilename} (
                  {((report.originalDocument?.sizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB)
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  >
                    <ZoomOut size={12} />
                  </Button>
                  <span className="font-mono text-[11px] px-1">{Math.round(zoomLevel * 100)}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  >
                    <ZoomIn size={12} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={handleDownload}
                  >
                    <Download size={12} /> Download
                  </Button>
                </div>
              </div>

              {loadingPreview ? (
                <div className="h-64 rounded-xl border border-border bg-muted/20 grid place-items-center text-xs text-muted-foreground">
                  <Spinner size={18} /> Loading document preview...
                </div>
              ) : previewBlobUrl ? (
                <div className="rounded-xl border border-border bg-black/5 overflow-auto max-h-[50vh] p-2 flex items-center justify-center">
                  {isImageFile ? (
                    <img
                      src={previewBlobUrl}
                      alt="Original Report"
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                      className="transition-transform duration-150 max-w-full rounded shadow-sm"
                    />
                  ) : isPdfFile ? (
                    <iframe
                      src={previewBlobUrl}
                      title="Report PDF"
                      className="w-full h-[45vh] rounded border border-border"
                    />
                  ) : (
                    <div className="text-center py-10 space-y-2">
                      <FileText size={32} className="mx-auto text-primary" />
                      <p className="text-xs font-medium text-foreground">
                        Document preview available via secure download.
                      </p>
                      <Button size="sm" onClick={handleDownload}>
                        <Download size={14} /> Download File
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 rounded-xl border border-border bg-muted/20 grid place-items-center text-xs text-muted-foreground">
                  Click below to securely download and view the original file.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Raw Machine Extracted OCR Text */}
          {activeTab === 'raw_ocr' && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg border border-border bg-muted/50 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>OCR Provider: {report.extraction?.provider || 'Tesseract OCR'}</span>
                <span>
                  Confidence:{' '}
                  {report.extraction?.confidence != null
                    ? `${Math.round(report.extraction.confidence * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <pre className="p-3 rounded-xl border border-border bg-card text-[11px] font-mono text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {report.extraction?.extractedText || 'No raw text available.'}
              </pre>
            </div>
          )}
        </div>
      ) : null}

      <DialogFooter className="flex-wrap gap-2">
        {report ? (
          <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={acting}>
            <Download size={14} /> Download Original Document
          </Button>
        ) : null}

        {canVerify && ['EXTRACTED', 'NEEDS_REVIEW'].includes(report?.status) ? (
          <Button
            type="button"
            size="sm"
            disabled={acting}
            onClick={() => runAction(() => reportsService.verifyReport(report.id || report._id))}
            className="gap-1.5"
          >
            <ShieldCheck size={14} /> Verify Clinical Report
          </Button>
        ) : null}

        <Button type="button" size="sm" onClick={() => onOpenChange(false)} disabled={acting}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
