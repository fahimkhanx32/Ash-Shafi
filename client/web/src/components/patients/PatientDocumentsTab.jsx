import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderOpen,
  FileText,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Share2,
} from 'lucide-react';

import * as reportsService from '../../services/reportsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Badge } from '../ui/badge.jsx';
import { Spinner } from '../ui/spinner.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table.jsx';
import {
  reportTypeLabel,
  reportStatusLabel,
  reportStatusVariant,
  intakeStatusLabel,
  intakeStatusVariant,
} from '../../constants/reports.js';
import { formatDate } from '../../lib/dateFormat.js';

import ReportDetailDialog from '../reports/ReportDetailDialog.jsx';
import StaffUploadReportDialog from '../reports/StaffUploadReportDialog.jsx';
import ReportDropzone from '../reports/ReportDropzone.jsx';

export default function PatientDocumentsTab({
  patientProfileId,
  patientName = 'Patient',
  canUpload = false,
  canVerify = false,
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const openWithFile = (file) => {
    setDroppedFile(file);
    setUploadOpen(true);
  };

  const loadDocuments = () => {
    if (!patientProfileId) return;
    setLoading(true);
    setError('');
    reportsService
      .listReportsByPatient(patientProfileId)
      .then((items) => {
        setDocuments(items || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(extractApiError(err).message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDocuments();
  }, [patientProfileId]);

  return (
    <div
      className="space-y-4"
      onDragOver={(e) => canUpload && e.preventDefault()}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        openWithFile(e.dataTransfer.files?.[0]);
      }}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="text-primary" size={18} />
            Patient Documents & Uploads
          </h3>
          <p className="text-xs text-muted-foreground">
            All medical files, lab scans, images, and external records uploaded by or for this patient.
          </p>
        </div>

        {canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5 shadow-xs">
            <Upload size={14} /> Upload Document for Patient
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-8 rounded-xl border border-border bg-card text-center text-xs text-muted-foreground space-y-2">
          <Spinner size={20} className="mx-auto" />
          <p>Loading patient documents...</p>
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={loadDocuments} />
      ) : documents.length === 0 && canUpload ? (
        <ReportDropzone
          onFile={openWithFile}
          title="patient document"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx"
          formatsLabel="PDF, JPG, PNG, WEBP, DOCX, XLSX"
          privacyNote="Filed on this patient's record · Access follows your clinic permissions"
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No Documents Uploaded"
          description="No reports or medical files have been uploaded for this patient yet."
          action={
            canUpload ? (
              <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                <Upload size={14} /> Upload First Document
              </Button>
            ) : null
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Intake Status</TableHead>
                <TableHead>Clinical Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const isPatientSource = doc.submission?.source === 'PATIENT_SUBMITTED';
                const uploaderRole = doc.submission?.uploadedByRole || 'Staff';

                return (
                  <TableRow key={doc.id || doc._id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <FileText size={15} className="text-primary shrink-0" />
                        <span className="truncate max-w-[220px]">{doc.title}</span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {doc.originalDocument?.originalFilename || doc.reportReference}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{reportTypeLabel(doc.reportType, t)}</Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-foreground">
                        {formatDate(doc.reportDate || doc.uploadDate)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${
                          isPatientSource
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {isPatientSource ? 'Patient' : uploaderRole}
                      </span>
                    </TableCell>

                    <TableCell>
                      {doc.submission?.intakeStatus ? (
                        <Badge variant={intakeStatusVariant(doc.submission.intakeStatus)}>
                          {intakeStatusLabel(doc.submission.intakeStatus, t)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={reportStatusVariant(doc.status)}>
                        {reportStatusLabel(doc.status, t)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs gap-1"
                        onClick={() => setSelectedReportId(doc.id || doc._id)}
                      >
                        <Eye size={13} /> View & OCR
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Report Detail Modal */}
      <ReportDetailDialog
        open={Boolean(selectedReportId)}
        onOpenChange={(next) => !next && setSelectedReportId(null)}
        reportId={selectedReportId}
        canWrite={canUpload}
        canVerify={canVerify}
        onChanged={loadDocuments}
      />

      {/* Staff Upload For Patient Dialog */}
      <StaffUploadReportDialog
        open={uploadOpen}
        onOpenChange={(next) => {
          setUploadOpen(next);
          if (!next) setDroppedFile(null);
        }}
        initialFile={droppedFile}
        preselectedPatientProfileId={patientProfileId}
        preselectedPatientName={patientName}
        onUploaded={() => {
          setUploadOpen(false);
          setDroppedFile(null);
          loadDocuments();
        }}
      />
    </div>
  );
}
