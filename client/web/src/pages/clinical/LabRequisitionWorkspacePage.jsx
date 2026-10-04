import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Save,
  CheckCircle2,
  Printer,
  Columns,
  Eye,
  Edit3,
  ArrowLeft,
  FlaskConical,
  User,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import * as patientsService from '../../services/patientsService.js';
import * as labRequisitionsService from '../../services/labRequisitionsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { PageHeader } from '../../components/ui/page-header.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Skeleton } from '../../components/ui/skeleton.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';
import { DEFAULT_TEST_CATALOG, DEFAULT_TEST_GROUPS } from '../../constants/testCatalog.js';

import TestSelector from '../../components/requisitions/TestSelector.jsx';
import { LabRequisitionDocument } from '../../components/requisitions/LabRequisitionDocument.jsx';

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export default function LabRequisitionWorkspacePage() {
  const { t } = useTranslation();
  const { patientProfileId, requisitionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const isNew = !requisitionId || requisitionId === 'new';
  const isWalkIn = patientProfileId === 'walkin' || !patientProfileId;

  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'split' : 'editor',
  );
  const [zoomLevel, setZoomLevel] = useState(0.5);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState(DEFAULT_TEST_CATALOG);
  const [groups, setGroups] = useState(DEFAULT_TEST_GROUPS);
  const [patient, setPatient] = useState(null);
  const [requisition, setRequisition] = useState(null);
  const [error, setError] = useState('');

  // Form State
  const [form, setForm] = useState({
    walkIn: {
      firstName: '',
      lastName: '',
      age: '',
      sex: '',
      phone: '',
      bloodGroup: 'Unknown',
    },
    clinicalDiagnosis: searchParams.get('diagnosis') || '',
    priority: 'ROUTINE',
    notes: '',
    tests: [],
    admissionDetails: {
      cabinSemiCabin: '',
      opdWardNo: '',
      bedNo: '',
      payingStatus: '',
    },
  });

  const observerRef = useRef(null);
  const printRef = useRef(null);

  const isIssued = requisition?.status === 'ISSUED' || requisition?.status === 'CANCELLED';
  const canWrite = !isIssued;

  // Auto-fit observer callback
  const previewContainerRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) setContainerWidth(rect.width);
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width || entry.target.getBoundingClientRect().width;
          if (w > 0) setContainerWidth(w);
        }
      });
      obs.observe(node);
      observerRef.current = obs;
    }
  }, []);

  const effectiveScale = useMemo(() => {
    if (isAutoFit) {
      if (containerWidth > 0) {
        const fit = Math.max(0.35, Math.min(1.05, (containerWidth - 48) / 794));
        return Number(fit.toFixed(2));
      }
      return viewMode === 'preview' ? 0.85 : 0.50;
    }
    return zoomLevel;
  }, [containerWidth, zoomLevel, isAutoFit, viewMode]);

  // Load Catalog & Patient/Requisition Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch live catalog (falls back to defaults if offline)
      try {
        const catData = await labRequisitionsService.getTestCatalog();
        if (catData?.tests?.length) {
          setCatalog(catData.tests);
          setGroups(catData.groups);
        }
      } catch (catErr) {
        console.warn('Using default test catalog:', catErr);
      }

      // 2. Fetch existing requisition if editing
      if (!isNew) {
        const reqDoc = await labRequisitionsService.getRequisition(requisitionId);
        setRequisition(reqDoc);
        setForm({
          walkIn: {
            firstName: reqDoc.patientSnapshot?.name?.split(' ')[0] || '',
            lastName: reqDoc.patientSnapshot?.name?.split(' ').slice(1).join(' ') || '',
            age: reqDoc.patientSnapshot?.age || '',
            sex: reqDoc.patientSnapshot?.sex || '',
            phone: reqDoc.patientSnapshot?.phone || '',
            bloodGroup: reqDoc.patientSnapshot?.bloodGroup || 'Unknown',
          },
          clinicalDiagnosis: reqDoc.clinicalDiagnosis || '',
          priority: reqDoc.priority || 'ROUTINE',
          notes: reqDoc.notes || '',
          tests: reqDoc.tests || [],
          admissionDetails: {
            cabinSemiCabin: reqDoc.admissionDetails?.cabinSemiCabin || '',
            opdWardNo: reqDoc.admissionDetails?.opdWardNo || '',
            bedNo: reqDoc.admissionDetails?.bedNo || '',
            payingStatus: reqDoc.admissionDetails?.payingStatus || '',
          },
        });
      }

      // 3. Fetch patient profile if registered
      if (!isWalkIn && patientProfileId && patientProfileId !== 'new') {
        const pat = await patientsService.getPatient(patientProfileId);
        setPatient(pat);
        if (isNew) {
          setForm((prev) => ({
            ...prev,
            walkIn: {
              firstName: pat.firstName || '',
              lastName: pat.lastName || '',
              age: pat.dateOfBirth ? String(new Date().getFullYear() - new Date(pat.dateOfBirth).getFullYear()) : '',
              sex: pat.gender || '',
              phone: pat.phone || pat.alternatePhone || '',
              bloodGroup: pat.bloodGroup || 'Unknown',
            },
          }));
        }
      }
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [isNew, isWalkIn, patientProfileId, requisitionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live document snapshot preview data
  /**
   * Toggles one test on/off directly from the printed checklist,
   * mirroring TestSelector.jsx's own toggle logic exactly (same
   * shape written into `form.tests`) so a tick made on the document
   * and a tick made in the structured TestSelector panel behave
   * identically and never diverge.
   */
  const handleToggleTestFromDocument = ({ code, name, category, costBDT }) => {
    setForm((prev) => {
      const exists = prev.tests.some((t) => t.code === code);
      const tests = exists
        ? prev.tests.filter((t) => t.code !== code)
        : [...prev.tests, { code, name, category, costBDT: costBDT || 0, notes: '' }];
      return { ...prev, tests };
    });
  };

  const handleDocumentFieldChange = (field, value) => {
    if (field.startsWith('walkIn.')) {
      const key = field.split('.')[1];
      setForm((prev) => ({ ...prev, walkIn: { ...prev.walkIn, [key]: value } }));
      return;
    }
    if (field.startsWith('admissionDetails.')) {
      const key = field.split('.')[1];
      setForm((prev) => ({ ...prev, admissionDetails: { ...prev.admissionDetails, [key]: value } }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const previewDoc = useMemo(() => {
    const totalCost = form.tests.reduce((acc, t) => acc + (Number(t.costBDT) || 0), 0);
    const patName = isWalkIn
      ? `${form.walkIn.firstName || 'Walk-in'} ${form.walkIn.lastName || 'Patient'}`.trim()
      : patient
      ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
      : 'Hasina';

    return {
      id: requisition?.requisitionReference || 'REQ-DRAFT',
      requisitionReference: requisition?.requisitionReference || 'REQ-DRAFT',
      createdAt: requisition?.createdAt || new Date(),
      clinicalDiagnosis: form.clinicalDiagnosis,
      priority: form.priority,
      notes: form.notes,
      totalCostBDT: totalCost,
      tests: form.tests,
      status: requisition?.status || 'DRAFT',
      patientSnapshot: {
        name: patName,
        patientId: patient?.patientId || 'WALK-IN',
        age: form.walkIn.age || (patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} Y` : '—'),
        sex: form.walkIn.sex || patient?.gender || '—',
        phone: form.walkIn.phone || patient?.phone || '—',
        bloodGroup: form.walkIn.bloodGroup || patient?.bloodGroup || '—',
      },
      doctorSnapshot: {
        name: user?.name || 'Prof. Dr. Rezwanur Rahman',
        qualifications: 'MBBS, MD (Nephrology), FRCP (Edin)',
        bmdc: '',
        chamberAddress: 'Popular Consultation Centre (Bldg-6), Room 306, Dhanmondi, Dhaka',
      },
      admissionDetails: form.admissionDetails,
    };
  }, [form, isWalkIn, patient, requisition, user]);

  // Save / Issue Actions
  const handleSave = async (issueImmediately = false) => {
    if (form.tests.length === 0) {
      toast.error('Please tick at least one test before saving.');
      return;
    }
    if (isWalkIn && !form.walkIn.firstName.trim()) {
      toast.error('Please enter the patient name for this walk-in requisition.');
      return;
    }

    setSaving(true);
    try {
      let result;
      if (isNew) {
        const payload = {
          patientProfileId: isWalkIn ? undefined : patientProfileId,
          walkIn: isWalkIn ? form.walkIn : undefined,
          tests: form.tests,
          clinicalDiagnosis: form.clinicalDiagnosis,
          priority: form.priority,
          notes: form.notes,
          admissionDetails: form.admissionDetails,
        };
        result = await labRequisitionsService.createRequisition(payload);
        setRequisition(result);
        toast.success('Lab requisition created successfully.');
      } else {
        // Persist edits made after the initial save — ticking boxes or
        // typing directly on the document (or the structured panels)
        // previously updated only local `form` state here and was
        // silently discarded, since no update endpoint existed.
        const updatePayload = {
          tests: form.tests,
          clinicalDiagnosis: form.clinicalDiagnosis,
          priority: form.priority,
          notes: form.notes,
          admissionDetails: form.admissionDetails,
          walkIn: isWalkIn ? form.walkIn : undefined,
        };
        result = await labRequisitionsService.updateRequisition(requisition.id, updatePayload);
        setRequisition(result);
        toast.success('Lab requisition updated successfully.');
      }

      if (issueImmediately && result?.id) {
        const issued = await labRequisitionsService.issueRequisition(result.id);
        setRequisition(issued);
        toast.success('Lab requisition issued & finalized.');
      }
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Top Header with Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 text-xs h-8"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical size={18} className="text-primary" />
              <h1 className="text-base font-bold text-foreground">
                {isNew ? 'New Lab Test Requisition' : `Requisition: ${requisition?.requisitionReference}`}
              </h1>
              <Badge
                variant={
                  requisition?.status === 'ISSUED'
                    ? 'success'
                    : requisition?.status === 'CANCELLED'
                    ? 'destructive'
                    : 'warning'
                }
              >
                {requisition?.status || 'DRAFT'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isWalkIn ? 'Walk-in / Any Patient' : `Patient: ${patient?.firstName || ''} ${patient?.lastName || ''} (${patient?.patientId || ''})`}
            </p>
          </div>
        </div>

        {/* Action Buttons & View Controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'editor' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Edit3 size={12} /> Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'split' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Columns size={12} /> Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'preview' ? 'bg-background shadow-xs text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Eye size={12} /> Preview
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs h-8"
          >
            <Printer size={14} />
            <span>Print Form</span>
          </Button>

          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="gap-1.5 text-xs h-8"
              >
                <Save size={14} />
                <span>Save Draft</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="gap-1.5 text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 size={14} />
                <span>Issue Requisition</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle size={16} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Dual-Pane Workspace */}
      <div
        className={`grid gap-6 w-full max-w-full ${
          viewMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]'
            : 'grid-cols-1'
        }`}
      >
        {/* LEFT PANE: REQUISITION EDITOR */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div className="space-y-4 min-w-0 w-full">
            {/* Patient Header / Walk-in Form */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <User size={15} className="text-primary" />
                  <span>Patient Demographics</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {isWalkIn ? 'Walk-in Mode' : `ID: ${patient?.patientId || '—'}`}
                </span>
              </div>

              {isWalkIn ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Patient Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Hasina Akter"
                      value={form.walkIn.firstName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          walkIn: { ...prev.walkIn, firstName: e.target.value },
                        }))
                      }
                      disabled={!canWrite}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Age & Sex</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Age (e.g. 46)"
                        value={form.walkIn.age}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            walkIn: { ...prev.walkIn, age: e.target.value },
                          }))
                        }
                        disabled={!canWrite}
                        className="w-1/2 h-8 px-2 text-xs rounded-lg border border-border bg-background"
                      />
                      <select
                        value={form.walkIn.sex}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            walkIn: { ...prev.walkIn, sex: e.target.value },
                          }))
                        }
                        disabled={!canWrite}
                        className="w-1/2 h-8 px-1.5 text-xs rounded-lg border border-border bg-background"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Phone / Blood Group</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Phone"
                        value={form.walkIn.phone}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            walkIn: { ...prev.walkIn, phone: e.target.value },
                          }))
                        }
                        disabled={!canWrite}
                        className="w-1/2 h-8 px-2 text-xs rounded-lg border border-border bg-background"
                      />
                      <select
                        value={form.walkIn.bloodGroup}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            walkIn: { ...prev.walkIn, bloodGroup: e.target.value },
                          }))
                        }
                        disabled={!canWrite}
                        className="w-1/2 h-8 px-1.5 text-xs rounded-lg border border-border bg-background"
                      >
                        {BLOOD_GROUP_OPTIONS.map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Name:</span>
                    <span className="font-semibold">{patient?.firstName} {patient?.lastName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Age / Sex:</span>
                    <span>{patient?.gender || '—'}, {patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} Y` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Blood Group:</span>
                    <span className="font-semibold text-rose-600">{patient?.bloodGroup || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Phone:</span>
                    <span>{patient?.phone || patient?.alternatePhone || '—'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Clinical Diagnosis & Priority */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-foreground">Clinical Diagnosis / Indication</label>
                  <input
                    type="text"
                    placeholder="e.g. Type 2 Diabetes Mellitus, CKD Stage 3, Hypertension, Recurrent UTI..."
                    value={form.clinicalDiagnosis}
                    onChange={(e) => setForm((prev) => ({ ...prev, clinicalDiagnosis: e.target.value }))}
                    disabled={!canWrite}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                    disabled={!canWrite}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT / Emergency</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Test Selection Checkbox Grid (CORE) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <TestSelector
                catalog={catalog}
                groups={groups}
                selectedTests={form.tests}
                onChange={(tests) => setForm((prev) => ({ ...prev, tests }))}
                disabled={!canWrite}
              />
            </div>
          </div>
        )}

        {/* RIGHT PANE: LIVE REQUISITION FORM PREVIEW */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="space-y-3 min-w-0 w-full flex flex-col items-center">
            {/* Preview Zoom Bar */}
            <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <Eye size={13} className="text-primary" /> Live A4 Document Preview (8.27" × 11.69")
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoFit(true);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    isAutoFit ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Automatically scale to fit container width"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoFit(false);
                    setZoomLevel((z) => Math.max(0.35, Number((z - 0.05).toFixed(2))));
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded border border-border bg-background text-xs hover:bg-muted"
                >
                  −
                </button>
                <span className="font-mono text-[11px] w-9 text-center font-bold text-foreground">
                  {Math.round(effectiveScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoFit(false);
                    setZoomLevel((z) => Math.min(1.0, Number((z + 0.05).toFixed(2))));
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded border border-border bg-background text-xs hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>

            {/* Document Render Container */}
            <div
              ref={previewContainerRef}
              className="w-full flex justify-center items-start rounded-2xl border border-border/70 bg-slate-200/50 dark:bg-slate-900/50 p-2 sm:p-4 overflow-x-auto min-h-[700px]"
            >
              <LabRequisitionDocument
                ref={printRef}
                requisition={previewDoc}
                scale={effectiveScale}
                showCosts={true}
                editable={canWrite}
                editableIdentity={canWrite && isWalkIn}
                onToggleTest={handleToggleTestFromDocument}
                onFieldChange={handleDocumentFieldChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
