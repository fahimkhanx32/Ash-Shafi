import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Inbox,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

import * as reportsService from '../services/reportsService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table.jsx';
import {
  REPORT_TYPES,
  reportTypeLabel,
  intakeStatusLabel,
  intakeStatusVariant,
} from '../constants/reports.js';
import { formatDate, formatRelativeTime } from '../lib/dateFormat.js';
import ReportDetailDialog from '../components/reports/ReportDetailDialog.jsx';
import ReportDropzone from '../components/reports/ReportDropzone.jsx';
import StaffUploadReportDialog from '../components/reports/StaffUploadReportDialog.jsx';
import { REPORTS_WRITE_ROLES } from '../constants/roles.js';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../components/ui/dialog.jsx';

const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function DoctorReportIntakePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState({ pending: 0 });
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Filters
  const [intakeStatus, setIntakeStatus] = useState('PENDING_REVIEW');
  const [reportType, setReportType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Detail / Review Modal
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Upload a document for any patient straight from the inbox.
  const canUpload = REPORTS_WRITE_ROLES.includes(user?.role);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);

  // Direct Review Action (Accept / Reject dialog)
  const [reviewDialog, setReviewDialog] = useState({ open: false, item: null, decision: 'ACCEPT', note: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const sum = await reportsService.getIntakeSummary();
      setSummary(sum || { pending: 0 });
    } catch {
      // best-effort
    }
  }, []);

  const loadItems = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const res = await reportsService.listIntake({
        intakeStatus: intakeStatus || undefined,
        page,
        limit: 20,
      });
      setItems(res.items || []);
      setPagination(res.pagination || null);
      setState('ready');
    } catch (err) {
      setErrorMessage(extractApiError(err).message);
      setState('error');
    }
  }, [intakeStatus, page]);

  useEffect(() => {
    loadItems();
    loadSummary();
  }, [loadItems, loadSummary]);

  const handleOpenReview = (item, decision) => {
    setReviewDialog({
      open: true,
      item,
      decision,
      note: decision === 'ACCEPT' ? 'Accepted into patient chart' : '',
    });
    setReviewError('');
  };

  const handleConfirmReview = async () => {
    if (!reviewDialog.item) return;
    const { item, decision, note } = reviewDialog;

    if (decision === 'REJECT' && note.trim().length < 3) {
      setReviewError('A rejection reason of at least 3 characters is required.');
      return;
    }

    setSubmittingReview(true);
    setReviewError('');
    try {
      await reportsService.reviewIntake(item.id || item._id, {
        decision,
        note: note.trim(),
      });
      toast({
        title: decision === 'ACCEPT' ? 'Report Accepted' : 'Report Rejected',
        description:
          decision === 'ACCEPT'
            ? 'The submission has been accepted into the patient chart.'
            : 'The submission was rejected with reason recorded.',
        variant: decision === 'ACCEPT' ? 'success' : 'neutral',
      });
      setReviewDialog({ open: false, item: null, decision: 'ACCEPT', note: '' });
      loadItems();
      loadSummary();
    } catch (err) {
      setReviewError(extractApiError(err).message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Filter items client-side for quick search or type if needed
  const filteredItems = items.filter((item) => {
    if (reportType && item.reportType !== reportType) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const pName = `${item.patientProfile?.firstName || ''} ${item.patientProfile?.lastName || ''}`.toLowerCase();
      const pId = (item.patientProfile?.patientId || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      return pName.includes(term) || pId.includes(term) || title.includes(term);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('nav.reports', 'Reports'), to: '/dashboard/reports' },
          { label: 'Report Intake Inbox' },
        ]}
        title="Report Intake / Patient Submissions"
        description="Review, verify, and route incoming medical reports submitted by patients or staff."
      />

      {canUpload ? (
        <ReportDropzone
          onFile={(file) => {
            setDroppedFile(file);
            setUploadOpen(true);
          }}
          title="patient document"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx"
          formatsLabel="PDF, JPG, PNG, WEBP, DOCX, XLSX"
          privacyNote="You'll choose the patient next · Access follows your clinic permissions"
        />
      ) : null}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => {
            setIntakeStatus('PENDING_REVIEW');
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            intakeStatus === 'PENDING_REVIEW'
              ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
              : 'border-border bg-card hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Review
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-foreground font-mono">
            {summary.pending}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Requires physician sign-off</p>
        </div>

        <div
          onClick={() => {
            setIntakeStatus('ACCEPTED');
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            intakeStatus === 'ACCEPTED'
              ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
              : 'border-border bg-card hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Accepted
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-foreground font-mono">Accepted</div>
          <p className="text-[11px] text-muted-foreground mt-1">Incorporated into patient chart</p>
        </div>

        <div
          onClick={() => {
            setIntakeStatus('REJECTED');
            setPage(1);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            intakeStatus === 'REJECTED'
              ? 'border-destructive bg-destructive/10 shadow-xs ring-1 ring-destructive/30'
              : 'border-border bg-card hover:border-destructive/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rejected
            </span>
            <XCircle size={16} className="text-destructive" />
          </div>
          <div className="text-2xl font-black mt-2 text-foreground font-mono">Rejected</div>
          <p className="text-[11px] text-muted-foreground mt-1">Unusable or illegible submissions</p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search patient name, ID, or report title..."
      >
        <select
          className={selectClass}
          value={intakeStatus}
          onChange={(e) => {
            setIntakeStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All Intake Statuses</option>
        </select>

        <select
          className={selectClass}
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
        >
          <option value="">All Report Types</option>
          {REPORT_TYPES.map((tVal) => (
            <option key={tVal} value={tVal}>
              {reportTypeLabel(tVal, t)}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            loadItems();
            loadSummary();
          }}
          className="gap-1.5 h-10"
        >
          <RefreshCw size={14} /> Refresh
        </Button>
      </FilterBar>

      {/* Main Content Area */}
      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Report Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={5} columns={7} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={loadItems} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            intakeStatus === 'PENDING_REVIEW'
              ? 'No Pending Reports'
              : 'No Submissions Found'
          }
          description={
            intakeStatus === 'PENDING_REVIEW'
              ? 'Your intake inbox is all caught up. New patient reports will appear here.'
              : 'Try changing your filters or searching with a different term.'
          }
        />
      ) : (
        <div className="space-y-4">
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Report Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const patientName = item.patientProfile
                    ? `${item.patientProfile.firstName || ''} ${item.patientProfile.lastName || ''}`.trim()
                    : 'Patient';
                  const patientId = item.patientProfile?.patientId || '—';
                  const isPending = item.submission?.intakeStatus === 'PENDING_REVIEW';
                  const isPatientSource = item.submission?.source === 'PATIENT_SUBMITTED';

                  return (
                    <TableRow key={item.id || item._id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold text-foreground text-sm">{patientName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{patientId}</div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-sm text-foreground max-w-[220px] truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {item.reportReference}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{reportTypeLabel(item.reportType, t)}</Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-foreground">
                          {formatDate(item.uploadDate)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(item.uploadDate)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                            isPatientSource
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                          }`}
                        >
                          {isPatientSource ? 'Patient Upload' : 'Staff On-Behalf'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge variant={intakeStatusVariant(item.submission?.intakeStatus)}>
                          {intakeStatusLabel(item.submission?.intakeStatus, t)}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-8 px-2.5 text-xs"
                          onClick={() => setSelectedReportId(item.id || item._id)}
                        >
                          <Eye size={13} /> View & OCR
                        </Button>

                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={() => handleOpenReview(item, 'ACCEPT')}
                            >
                              <CheckCircle2 size={13} /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2.5 text-xs gap-1"
                              onClick={() => handleOpenReview(item, 'REJECT')}
                            >
                              <XCircle size={13} /> Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {pagination && pagination.pages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.pages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Full Report Details Dialog (Original file, OCR Data, Parameters, Verify) */}
      <ReportDetailDialog
        open={Boolean(selectedReportId)}
        onOpenChange={(next) => !next && setSelectedReportId(null)}
        reportId={selectedReportId}
        canWrite={true}
        canVerify={true}
        onChanged={() => {
          loadItems();
          loadSummary();
        }}
      />

      {canUpload && uploadOpen ? (
        <StaffUploadReportDialog
          open={uploadOpen}
          onOpenChange={(next) => {
            setUploadOpen(next);
            if (!next) setDroppedFile(null);
          }}
          initialFile={droppedFile}
          onUploaded={() => {
            setUploadOpen(false);
            setDroppedFile(null);
            loadItems();
            loadSummary();
          }}
        />
      ) : null}

      {/* Review Confirmation Dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(next) => !submittingReview && setReviewDialog((prev) => ({ ...prev, open: next }))}
        className="max-w-md"
      >
        <DialogCloseButton
          onClose={() =>
            !submittingReview && setReviewDialog((prev) => ({ ...prev, open: false }))
          }
        />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {reviewDialog.decision === 'ACCEPT' ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-500" /> Accept Report into Chart
              </>
            ) : (
              <>
                <XCircle size={18} className="text-destructive" /> Reject Submission
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {reviewDialog.decision === 'ACCEPT'
              ? 'Confirming that this report belongs in the patient medical record. Note: This records acceptance into chart; per-parameter clinical verification can follow.'
              : 'Please provide a clear reason why this report cannot be accepted (e.g. blurry image, wrong patient name).'}
          </DialogDescription>
        </DialogHeader>

        {reviewError ? (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{reviewError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-3 space-y-3">
          <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
            <div className="font-semibold text-foreground">{reviewDialog.item?.title}</div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>Patient: {reviewDialog.item?.patientProfile?.firstName} {reviewDialog.item?.patientProfile?.lastName}</span>
              <span>Ref: {reviewDialog.item?.reportReference}</span>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {reviewDialog.decision === 'REJECT' ? 'Rejection Reason *' : 'Review Note (Optional)'}
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
              value={reviewDialog.note}
              disabled={submittingReview}
              onChange={(e) => setReviewDialog((prev) => ({ ...prev, note: e.target.value }))}
              placeholder={
                reviewDialog.decision === 'REJECT'
                  ? 'e.g. Image unreadable, please re-scan or upload higher resolution.'
                  : 'Optional note for clinical record'
              }
              maxLength={500}
              required={reviewDialog.decision === 'REJECT'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submittingReview}
            onClick={() => setReviewDialog((prev) => ({ ...prev, open: false }))}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              submittingReview ||
              (reviewDialog.decision === 'REJECT' && reviewDialog.note.trim().length < 3)
            }
            variant={reviewDialog.decision === 'ACCEPT' ? 'default' : 'destructive'}
            onClick={handleConfirmReview}
            className="gap-1.5"
          >
            {submittingReview ? (
              <>
                <Spinner size={14} /> Submitting...
              </>
            ) : reviewDialog.decision === 'ACCEPT' ? (
              <>
                <CheckCircle2 size={14} /> Accept Report
              </>
            ) : (
              <>
                <XCircle size={14} /> Reject Report
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
