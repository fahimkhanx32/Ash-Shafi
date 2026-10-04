import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Printer,
  Search,
  ExternalLink,
  Edit,
  CheckCircle2,
  Clock,
  Ban,
  User,
  Pill,
  Trash2,
} from 'lucide-react';

import * as prescriptionsService from '../services/prescriptionsService.js';
import * as patientsService from '../services/patientsService.js';
import { extractApiError } from '../services/apiClient.js';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { PRESCRIPTIONS_WRITE_ROLES, ROLES } from '../constants/roles.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { TableSkeleton } from '../components/ui/skeleton.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
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
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../components/ui/dialog.jsx';
import { formatDate } from '../lib/dateFormat.js';

const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';
const inputClass = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function PrescriptionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();

  const isSuperOrOwner = user?.role === ROLES.SOFTWARE_OWNER || user?.role === ROLES.SUPER_ADMIN;
  const canWrite = PRESCRIPTIONS_WRITE_ROLES.includes(user?.role);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // New Prescription dialog state
  const [isSelectPatientOpen, setIsSelectPatientOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState('search'); // 'search' | 'walkin'
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);

  const [walkinForm, setWalkinForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    age: '',
    bloodGroup: 'UNKNOWN',
    phone: '',
  });
  const [walkinSaving, setWalkinSaving] = useState(false);
  const [walkinError, setWalkinError] = useState('');

  const handleQuickWalkinSubmit = async (e) => {
    e.preventDefault();
    setWalkinSaving(true);
    setWalkinError('');

    const approxYear = new Date().getFullYear() - (parseInt(walkinForm.age, 10) || 30);
    const dob = `${approxYear}-01-01`;

    try {
      const created = await patientsService.createPatient({
        firstName: walkinForm.firstName.trim(),
        lastName: walkinForm.lastName.trim(),
        gender: walkinForm.gender,
        dateOfBirth: dob,
        bloodGroup: walkinForm.bloodGroup,
        phone: walkinForm.phone.trim() || undefined,
      });

      setIsSelectPatientOpen(false);
      const newPid = created?.id || created?._id;
      navigate(`/dashboard/patients/${newPid}/prescriptions/new`);
    } catch (err) {
      setWalkinError(extractApiError(err).message || 'Failed to create patient profile.');
    } finally {
      setWalkinSaving(false);
    }
  };

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await prescriptionsService.listPrescriptions({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
      });
      setItems(result.items || []);
      setPagination(result.pagination || null);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const searchPatients = async (query) => {
    setPatientQuery(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    setPatientSearching(true);
    try {
      const { items: found } = await patientsService.listPatients({ search: query.trim(), limit: 10 });
      setPatientResults(found || []);
    } catch {
      setPatientResults([]);
    } finally {
      setPatientSearching(false);
    }
  };

  const handleOpenPdf = async (prescriptionId) => {
    try {
      const blobUrl = await prescriptionsService.getPrescriptionPdfBlobUrl(prescriptionId);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(extractApiError(err).message || 'Failed to generate PDF.');
    }
  };

  const handleDiscardOrDelete = async (e, prescription, { hardDelete = false } = {}) => {
    e.stopPropagation();
    const isDraft = prescription.status === 'DRAFT';
    const rxId = prescription.prescriptionId || prescription.id || prescription._id;

    if (hardDelete && isSuperOrOwner) {
      const ok = await confirm({
        title: t('clinical.prescriptions.confirmPurgeTitle', '⚠️ Permanently delete prescription {{id}}?', { id: rxId }),
        description: t(
          'clinical.prescriptions.confirmPurgeDesc',
          'This action is IRREVERSIBLE. It will completely erase this prescription record from MongoDB.',
        ),
        confirmLabel: t('clinical.prescriptions.confirmPurge', 'Yes, permanently delete'),
        variant: 'destructive',
      });
      if (!ok) return;

      try {
        await prescriptionsService.deletePrescription(prescription.id || prescription._id, { hardDelete: true });
        toast({ title: t('clinical.prescriptions.purgedSuccess', 'Prescription permanently deleted from database'), variant: 'success' });
        load();
      } catch (err) {
        toast({ title: 'Failed to delete prescription', description: extractApiError(err).message, variant: 'destructive' });
      }
      return;
    }

    if (isDraft) {
      const ok = await confirm({
        title: t('clinical.prescriptions.confirmDiscardTitle', 'Discard prescription draft {{id}}?', { id: rxId }),
        description: t(
          'clinical.prescriptions.confirmDiscardDesc',
          'This will delete this unfinalized prescription draft. This action cannot be undone.',
        ),
        confirmLabel: t('clinical.prescriptions.confirmDiscard', 'Discard Draft'),
        variant: 'destructive',
      });
      if (!ok) return;

      try {
        await prescriptionsService.deletePrescription(prescription.id || prescription._id);
        toast({ title: t('clinical.prescriptions.discardedSuccess', 'Draft prescription discarded'), variant: 'success' });
        load();
      } catch (err) {
        toast({ title: 'Failed to discard draft', description: extractApiError(err).message, variant: 'destructive' });
      }
      return;
    }

    // Finalized -> Cancel
    const ok = await confirm({
      title: t('clinical.prescriptions.confirmCancelTitle', 'Cancel / Discard prescription {{id}}?', { id: rxId }),
      description: t(
        'clinical.prescriptions.confirmCancelDesc',
        'This prescription will be marked as CANCELLED with a clinical audit note.',
      ),
      confirmLabel: t('clinical.prescriptions.confirmCancel', 'Cancel Prescription'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await prescriptionsService.cancelPrescription(prescription.id || prescription._id, 'Prescription cancelled by clinician.');
      toast({ title: t('clinical.prescriptions.cancelledSuccess', 'Prescription marked as cancelled'), variant: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Failed to cancel prescription', description: extractApiError(err).message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (itemStatus) => {
    switch (itemStatus) {
      case 'FINALIZED':
        return <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Finalized</Badge>;
      case 'DRAFT':
        return <Badge variant="warning" className="gap-1"><Clock size={12} /> Draft</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive" className="gap-1"><Ban size={12} /> Cancelled</Badge>;
      case 'SUPERSEDED':
        return <Badge variant="secondary" className="gap-1">Revised</Badge>;
      default:
        return <Badge variant="outline">{itemStatus}</Badge>;
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('dashboard.breadcrumb', 'Dashboard'), to: '/dashboard' },
          { label: t('clinical.prescriptions.title', 'Prescriptions') },
        ]}
        title={t('clinical.prescriptions.title', 'Prescriptions')}
        description={t('clinical.prescriptions.rosterDescription', 'Manage, search, draft, and print patient medical prescriptions.')}
        actions={
          canWrite ? (
            <Button
              className="gap-2 shadow-sm"
              onClick={() => setIsSelectPatientOpen(true)}
            >
              <Plus size={16} />
              {t('clinical.prescriptions.writeNew', 'Write Prescription')}
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('clinical.prescriptions.searchPlaceholder', 'Search by prescription ID, patient name, ID, phone, drug or diagnosis...')}
      >
        <select
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('clinical.prescriptions.filterByStatus', 'Filter by status')}
        >
          <option value="">{t('clinical.prescriptions.allStatuses', 'All Statuses')}</option>
          <option value="FINALIZED">Finalized</option>
          <option value="DRAFT">Draft</option>
          <option value="SUPERSEDED">Revised (Superseded)</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </FilterBar>

      {state === 'loading' ? (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Prescription ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Diagnosis / Complaint</TableHead>
                <TableHead>Medicines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={6} columns={7} />
            </TableBody>
          </Table>
        </TableContainer>
      ) : state === 'error' ? (
        <ErrorState description={errorMessage} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('clinical.prescriptions.noPrescriptionsTitle', 'No prescriptions found')}
          description={t('clinical.prescriptions.noPrescriptionsDesc', 'No prescriptions match your search criteria. Click Write Prescription to create one.')}
          action={
            canWrite ? (
              <Button onClick={() => setIsSelectPatientOpen(true)} className="gap-2">
                <Plus size={16} /> {t('clinical.prescriptions.writeNew', 'Write Prescription')}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {items.map((prescription) => {
              const pProfileId = prescription.patientProfile?._id || prescription.patientProfile?.id || prescription.patientProfile;
              const patientName = prescription.patientSnapshot?.name ||
                (prescription.patientProfile?.firstName ? `${prescription.patientProfile.firstName} ${prescription.patientProfile.lastName || ''}` : 'Patient');
              const patientId = prescription.patientSnapshot?.patientId || prescription.patientProfile?.patientId || '—';

              return (
                <div
                  key={prescription.id || prescription._id}
                  className="w-full rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-foreground tracking-wide font-mono text-sm">
                        {prescription.prescriptionId}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(prescription.prescriptionDate)}
                      </p>
                    </div>
                    {getStatusBadge(prescription.status)}
                  </div>

                  <div className="text-sm">
                    <p className="font-medium text-foreground">{patientName}</p>
                    <p className="text-xs text-muted-foreground">ID: {patientId}</p>
                  </div>

                  {(prescription.diagnosisSummary || prescription.chiefComplaint) && (
                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded">
                      <span className="font-medium text-foreground">Diagnosis:</span> {prescription.diagnosisSummary || prescription.chiefComplaint}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Pill size={13} /> {prescription.items?.length || 0} medicines
                    </span>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => handleOpenPdf(prescription.id || prescription._id)}
                      >
                        <Printer size={13} /> PDF
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => navigate(`/dashboard/patients/${pProfileId}/prescriptions/${prescription.id || prescription._id}/edit`)}
                      >
                        <Edit size={13} /> Open
                      </Button>
                      {prescription.status === 'DRAFT' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={(e) => handleDiscardOrDelete(e, prescription)}
                          title="Discard unfinalized draft"
                        >
                          <Trash2 size={13} /> Discard
                        </Button>
                      ) : null}
                      {isSuperOrOwner ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1 text-xs bg-red-700 hover:bg-red-800"
                          onClick={(e) => handleDiscardOrDelete(e, prescription, { hardDelete: true })}
                          title="Permanently remove from database (Owner / Super Admin)"
                        >
                          <Trash2 size={13} /> Purge
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Prescription ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Diagnosis / Chief Complaint</TableHead>
                    <TableHead>Medicines</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((prescription) => {
                    const pProfileId = prescription.patientProfile?._id || prescription.patientProfile?.id || prescription.patientProfile;
                    const patientName = prescription.patientSnapshot?.name ||
                      (prescription.patientProfile?.firstName ? `${prescription.patientProfile.firstName} ${prescription.patientProfile.lastName || ''}` : 'Patient');
                    const patientId = prescription.patientSnapshot?.patientId || prescription.patientProfile?.patientId || '—';

                    return (
                      <TableRow key={prescription.id || prescription._id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                          {formatDate(prescription.prescriptionDate)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {prescription.prescriptionId}
                        </TableCell>
                        <TableCell>
                          <div
                            className="cursor-pointer text-sm font-medium hover:underline text-foreground"
                            onClick={() => navigate(`/dashboard/patients/${pProfileId}?tab=prescriptions`)}
                          >
                            {patientName}
                          </div>
                          <div className="text-xs text-muted-foreground">ID: {patientId}</div>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {prescription.diagnosisSummary || prescription.chiefComplaint || '—'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            <Pill size={12} /> {prescription.items?.length || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(prescription.status)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2.5 text-xs"
                              title="Print / View Legal PDF"
                              onClick={() => handleOpenPdf(prescription.id || prescription._id)}
                            >
                              <Printer size={13} /> PDF
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 gap-1 px-2.5 text-xs"
                              onClick={() => navigate(`/dashboard/patients/${pProfileId}/prescriptions/${prescription.id || prescription._id}/edit`)}
                            >
                              <Edit size={13} /> {prescription.status === 'FINALIZED' ? 'View/Revise' : 'Edit Draft'}
                            </Button>
                            {prescription.status === 'DRAFT' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={(e) => handleDiscardOrDelete(e, prescription)}
                                title="Discard Draft"
                              >
                                <Trash2 size={13} /> Discard
                              </Button>
                            ) : prescription.status === 'FINALIZED' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
                                onClick={(e) => handleDiscardOrDelete(e, prescription)}
                                title="Cancel / Discard Prescription"
                              >
                                <Ban size={13} /> Cancel
                              </Button>
                            ) : null}
                            {isSuperOrOwner ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 gap-1 px-2 text-xs bg-red-700 hover:bg-red-800"
                                onClick={(e) => handleDiscardOrDelete(e, prescription, { hardDelete: true })}
                                title="Permanently Purge from Database (Owner / Super Admin)"
                              >
                                <Trash2 size={13} /> Purge
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          <Pagination
            className="mt-4"
            page={pagination?.page || page}
            totalPages={pagination?.pages || pagination?.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Select Patient Dialog to start writing a prescription */}
      <Dialog
        open={isSelectPatientOpen}
        onOpenChange={setIsSelectPatientOpen}
        className="max-w-lg"
      >
        <DialogCloseButton onClose={() => setIsSelectPatientOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User size={18} className="text-primary" /> Select or Create Patient for Prescription
          </DialogTitle>
          <DialogDescription>
            Choose an existing patient or quickly enter walk-in patient details to start prescribing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick tab toggle */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setDialogTab('search')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                dialogTab === 'search'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Search Existing
            </button>
            <button
              type="button"
              onClick={() => setDialogTab('walkin')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                dialogTab === 'walkin'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              + Quick Walk-in Patient
            </button>
          </div>

          {dialogTab === 'search' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  className={`${inputClass} pl-9`}
                  placeholder="Type patient name, phone, or ID (e.g. PAT-)..."
                  value={patientQuery}
                  onChange={(e) => searchPatients(e.target.value)}
                />
              </div>

              {patientSearching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Searching patients...
                </div>
              ) : patientResults.length > 0 ? (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {patientResults.map((p) => {
                    const pid = p.id || p._id;
                    return (
                      <button
                        key={pid}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-accent/40 transition-colors flex items-center justify-between gap-3"
                        onClick={() => {
                          setIsSelectPatientOpen(false);
                          navigate(`/dashboard/patients/${pid}/prescriptions/new`);
                        }}
                      >
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {p.firstName} {p.lastName || ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {p.patientId} {p.phone ? `· Phone: ${p.phone}` : ''} {p.gender ? `· ${p.gender}` : ''}
                          </p>
                        </div>
                        <span className="text-xs text-primary font-medium flex items-center gap-1 shrink-0">
                          Select <ExternalLink size={12} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : patientQuery.trim().length >= 2 ? (
                <div className="text-center py-6 px-4 text-sm text-muted-foreground bg-muted/20 rounded-xl space-y-3">
                  <p>No existing patients found matching "{patientQuery}".</p>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setWalkinForm((prev) => ({
                        ...prev,
                        firstName: patientQuery.split(' ')[0] || patientQuery,
                        lastName: patientQuery.split(' ').slice(1).join(' ') || 'Patient',
                      }));
                      setDialogTab('walkin');
                    }}
                  >
                    <Plus size={14} /> Write for New Walk-in Patient "{patientQuery}"
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Type at least 2 characters to search, or switch to <strong>Quick Walk-in Patient</strong>.
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleQuickWalkinSubmit} className="space-y-3">
              {walkinError && (
                <Alert variant="destructive">
                  <AlertDescription>{walkinError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">First Name *</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="e.g. John"
                    value={walkinForm.firstName}
                    onChange={(e) => setWalkinForm({ ...walkinForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Last Name *</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="e.g. Doe"
                    value={walkinForm.lastName}
                    onChange={(e) => setWalkinForm({ ...walkinForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Gender *</label>
                  <select
                    className={selectClass + ' w-full'}
                    value={walkinForm.gender}
                    onChange={(e) => setWalkinForm({ ...walkinForm, gender: e.target.value })}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Age (Years) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="130"
                    className={inputClass}
                    placeholder="e.g. 35"
                    value={walkinForm.age}
                    onChange={(e) => setWalkinForm({ ...walkinForm, age: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Blood Group</label>
                  <select
                    className={selectClass + ' w-full'}
                    value={walkinForm.bloodGroup}
                    onChange={(e) => setWalkinForm({ ...walkinForm, bloodGroup: e.target.value })}
                  >
                    <option value="UNKNOWN">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Phone Number (Optional)</label>
                <input
                  className={inputClass}
                  placeholder="e.g. 017xxxxxxxx"
                  value={walkinForm.phone}
                  onChange={(e) => setWalkinForm({ ...walkinForm, phone: e.target.value })}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectPatientOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={walkinSaving} className="gap-1.5">
                  {walkinSaving ? 'Opening Prescription…' : 'Start Prescription'}
                </Button>
              </div>
            </form>
          )}
        </div>

        {dialogTab === 'search' && (
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsSelectPatientOpen(false);
                navigate('/dashboard/patients');
              }}
            >
              Browse All Patients
            </Button>
          </DialogFooter>
        )}
      </Dialog>
    </div>
  );
}
