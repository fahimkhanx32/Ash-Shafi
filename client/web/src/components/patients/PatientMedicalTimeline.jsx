import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Calendar,
  Stethoscope,
  Pill,
  FileText,
  FlaskConical,
  Receipt,
  User,
  Eye,
  Filter,
  Search,
  Upload,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

import * as encountersService from '../../services/encountersService.js';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import * as reportsService from '../../services/reportsService.js';
import * as investigationsService from '../../services/investigationsService.js';
import * as labRequisitionsService from '../../services/labRequisitionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { Spinner } from '../ui/spinner.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { formatDate, formatRelativeTime } from '../../lib/dateFormat.js';

import PrescriptionDetailDialog from '../prescriptions/PrescriptionDetailDialog.jsx';
import ReportDetailDialog from '../reports/ReportDetailDialog.jsx';
import InvestigationDetailDialog from '../reports/InvestigationDetailDialog.jsx';
import LabRequisitionDetailDialog from '../requisitions/LabRequisitionDetailDialog.jsx';
import StaffUploadReportDialog from '../reports/StaffUploadReportDialog.jsx';
import { reportTypeLabel, intakeStatusLabel, intakeStatusVariant } from '../../constants/reports.js';

export default function PatientMedicalTimeline({
  patientProfileId,
  patientName = 'Patient',
  canUpload = false,
  canVerify = false,
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineItems, setTimelineItems] = useState([]);

  // Filter & Search
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'CONSULTATION' | 'PRESCRIPTION' | 'REPORT' | 'INVESTIGATION'
  const [search, setSearch] = useState('');

  // Modals
  const [detailModal, setDetailModal] = useState({ type: null, id: null });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);

  const loadTimeline = useCallback(async () => {
    if (!patientProfileId) return;
    setLoading(true);
    setError('');

    try {
      const [encountersRes, prescriptionsRes, reportsRes, investigationsRes, requisitionsRes] =
        await Promise.allSettled([
          encountersService.listEncountersByPatient(patientProfileId),
          prescriptionsService.listPrescriptionsByPatient(patientProfileId),
          reportsService.listReportsByPatient(patientProfileId),
          investigationsService.listInvestigationsByPatient(patientProfileId),
          labRequisitionsService.listRequisitionsByPatient(patientProfileId),
        ]);

      const items = [];

      // 1. Consultations
      if (encountersRes.status === 'fulfilled' && Array.isArray(encountersRes.value)) {
        encountersRes.value.forEach((enc) => {
          items.push({
            id: enc.id || enc._id,
            type: 'CONSULTATION',
            date: new Date(enc.encounterDate || enc.createdAt || Date.now()),
            title: enc.chiefComplaint || 'Clinical Consultation',
            subtitle: enc.doctorDetails?.name ? `Dr. ${enc.doctorDetails.name}` : 'Consulting Doctor',
            badge: enc.status || 'FINALIZED',
            badgeVariant: enc.status === 'FINALIZED' ? 'success' : 'neutral',
            details: enc.diagnosis || enc.clinicalSummary || '',
            raw: enc,
          });
        });
      }

      // 2. Prescriptions (All doctors)
      if (prescriptionsRes.status === 'fulfilled' && Array.isArray(prescriptionsRes.value)) {
        prescriptionsRes.value.forEach((rx) => {
          const docName = rx.doctorSnapshot?.name || 'Prescribing Doctor';
          const medCount = rx.items?.length || 0;
          items.push({
            id: rx.id || rx._id,
            type: 'PRESCRIPTION',
            date: new Date(rx.prescriptionDate || rx.createdAt || Date.now()),
            title: `Prescription #${rx.prescriptionNumber || rx.id?.slice(-6) || ''}`,
            subtitle: `Dr. ${docName}`,
            badge: rx.status || 'ISSUED',
            badgeVariant: rx.status === 'SUPERSEDED' ? 'neutral' : 'info',
            details: `${medCount} medicine(s) prescribed ${rx.diagnosis ? `• Diagnosis: ${rx.diagnosis}` : ''}`,
            raw: rx,
          });
        });
      }

      // 3. Reports & Uploaded Documents
      if (reportsRes.status === 'fulfilled' && Array.isArray(reportsRes.value)) {
        reportsRes.value.forEach((rep) => {
          const uploaderRole = rep.submission?.uploadedByRole || 'Staff';
          const isPatient = rep.submission?.source === 'PATIENT_SUBMITTED';
          const sourceText = isPatient ? 'Uploaded by Patient' : `Uploaded by ${uploaderRole}`;
          const intakeStatus = rep.submission?.intakeStatus;

          items.push({
            id: rep.id || rep._id,
            type: 'REPORT',
            date: new Date(rep.reportDate || rep.uploadDate || rep.createdAt || Date.now()),
            title: rep.title || 'Medical Report',
            subtitle: `${sourceText} ${rep.submission?.targetDoctor?.name ? `→ Dr. ${rep.submission.targetDoctor.name}` : ''}`,
            badge: intakeStatus || rep.status || 'UPLOADED',
            badgeVariant: intakeStatus
              ? intakeStatusVariant(intakeStatus)
              : rep.status === 'VERIFIED'
              ? 'success'
              : 'neutral',
            details: `${reportTypeLabel(rep.reportType, t)} • ${rep.parameters?.length || 0} parameter(s) extracted`,
            // Original / OCR / verification are distinct states: OCR output is
            // machine-extracted and stays unverified until a clinician verifies.
            ocrStatus: rep.extraction?.status || rep.ocr?.status || null,
            verified: rep.verification?.status === 'VERIFIED' || rep.verificationStatus === 'VERIFIED',
            verifiedAt: rep.verification?.verifiedAt || rep.verifiedAt || null,
            intakeStatus,
            raw: rep,
          });
        });
      }

      // 4. Investigations
      if (investigationsRes.status === 'fulfilled' && Array.isArray(investigationsRes.value)) {
        investigationsRes.value.forEach((inv) => {
          items.push({
            id: inv.id || inv._id,
            type: 'INVESTIGATION',
            date: new Date(inv.orderedDate || inv.createdAt || Date.now()),
            title: `Investigation: ${inv.name}`,
            subtitle: inv.orderingDoctor?.name ? `Ordered by Dr. ${inv.orderingDoctor.name}` : 'Investigation Order',
            badge: inv.status || 'ORDERED',
            badgeVariant: inv.status === 'COMPLETED' ? 'success' : 'warning',
            details: inv.clinicalIndication || inv.category || '',
            raw: inv,
          });
        });
      }

      // 5. Lab Requisitions
      if (requisitionsRes.status === 'fulfilled' && Array.isArray(requisitionsRes.value)) {
        requisitionsRes.value.forEach((req) => {
          items.push({
            id: req.id || req._id,
            type: 'REQUISITION',
            date: new Date(req.createdAt || Date.now()),
            title: `Lab Requisition (${req.requisitionReference || ''})`,
            subtitle: `${(req.tests || []).length} test(s) advised`,
            badge: req.status || 'ISSUED',
            badgeVariant: 'info',
            details: `Total: ৳${(req.totalCostBDT || 0).toLocaleString('en-BD')} BDT`,
            raw: req,
          });
        });
      }

      // Sort by date descending
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTimelineItems(items);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [patientProfileId, t]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    return timelineItems.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.subtitle.toLowerCase().includes(query) ||
          item.details.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [timelineItems, typeFilter, search]);

  const getItemIcon = (type) => {
    switch (type) {
      case 'CONSULTATION':
        return <Stethoscope size={16} className="text-blue-500" />;
      case 'PRESCRIPTION':
        return <Pill size={16} className="text-emerald-500" />;
      case 'REPORT':
        return <FileText size={16} className="text-indigo-500" />;
      case 'INVESTIGATION':
        return <FlaskConical size={16} className="text-amber-500" />;
      case 'REQUISITION':
        return <Receipt size={16} className="text-teal-500" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const handleOpenDetail = (item) => {
    setDetailModal({ type: item.type, id: item.id });
  };

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => canUpload && e.preventDefault()}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) {
          setDroppedFile(f);
          setUploadDialogOpen(true);
        }
      }}
    >
      {/* Header controls & actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="text-primary" size={18} />
            Unified Medical Timeline
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete chronological medical history of consultations, prescriptions, reports, and investigations.
          </p>
        </div>

        {canUpload && (
          <Button
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
            className="gap-1.5 shadow-xs"
          >
            <Upload size={14} /> Upload Document for Patient
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Type pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
          {[
            { id: 'ALL', label: 'All History' },
            { id: 'CONSULTATION', label: 'Consultations' },
            { id: 'PRESCRIPTION', label: 'Prescriptions' },
            { id: 'REPORT', label: 'Reports & Scans' },
            { id: 'INVESTIGATION', label: 'Investigations' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setTypeFilter(pill.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeFilter === pill.id
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search records, diagnoses, medicines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-8 rounded-xl border border-border bg-card text-center text-xs text-muted-foreground space-y-2">
          <Spinner size={24} className="mx-auto" />
          <p>Compiling unified patient timeline...</p>
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={loadTimeline} />
      ) : filteredTimeline.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No Medical Records Found"
          description="There are no historical records matching your filters."
        />
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {filteredTimeline.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="relative p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all shadow-xs group"
            >
              {/* Dot icon on the timeline track */}
              <div className="absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full border-2 border-background bg-card shadow-xs grid place-items-center -translate-x-1/2">
                {getItemIcon(item.type)}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatDate(item.date)} ({formatRelativeTime(item.date)})
                    </span>
                    <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                  </div>

                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs gap-1 opacity-90 group-hover:opacity-100"
                  onClick={() => handleOpenDetail(item)}
                >
                  <Eye size={13} /> View Record
                </Button>
              </div>

              {item.details && (
                <div className="mt-2.5 pt-2 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {item.details}
                    {item.type === 'REPORT' && (
                      <>
                        {item.ocrStatus && item.ocrStatus !== 'NOT_STARTED' && (
                          <Badge variant="neutral">OCR: {item.ocrStatus}</Badge>
                        )}
                        <Badge variant={item.verified ? 'success' : 'warning'}>
                          {item.verified
                            ? `Verified${item.verifiedAt ? ` ${formatDate(item.verifiedAt)}` : ''}`
                            : 'Unverified'}
                        </Badge>
                      </>
                    )}
                  </span>
                  {item.type === 'REPORT' && item.intakeStatus === 'PENDING_REVIEW' && (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={12} /> Needs Intake Review
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modals */}
      <PrescriptionDetailDialog
        open={detailModal.type === 'PRESCRIPTION'}
        onOpenChange={(next) => !next && setDetailModal({ type: null, id: null })}
        prescriptionId={detailModal.id}
        canWrite={false}
      />

      <ReportDetailDialog
        open={detailModal.type === 'REPORT'}
        onOpenChange={(next) => !next && setDetailModal({ type: null, id: null })}
        reportId={detailModal.id}
        canWrite={canUpload}
        canVerify={canVerify}
        onChanged={loadTimeline}
      />

      <InvestigationDetailDialog
        open={detailModal.type === 'INVESTIGATION'}
        onOpenChange={(next) => !next && setDetailModal({ type: null, id: null })}
        investigationId={detailModal.id}
        canWrite={false}
      />

      <LabRequisitionDetailDialog
        open={detailModal.type === 'REQUISITION'}
        onOpenChange={(next) => !next && setDetailModal({ type: null, id: null })}
        requisitionId={detailModal.id}
      />

      {/* Upload Document For Patient Dialog */}
      <StaffUploadReportDialog
        open={uploadDialogOpen}
        onOpenChange={(next) => {
          setUploadDialogOpen(next);
          if (!next) setDroppedFile(null);
        }}
        initialFile={droppedFile}
        preselectedPatientProfileId={patientProfileId}
        preselectedPatientName={patientName}
        onUploaded={() => {
          setUploadDialogOpen(false);
          setDroppedFile(null);
          loadTimeline();
        }}
      />
    </div>
  );
}
