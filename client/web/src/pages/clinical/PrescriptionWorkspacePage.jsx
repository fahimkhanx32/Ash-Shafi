import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  CheckCircle2,
  Printer,
  Download,
  Share2,
  Copy,
  History,
  Eye,
  Edit3,
  Columns,
  ArrowLeft,
  Calendar,
  AlertCircle,
  FileCheck,
  Maximize2,
  RotateCcw,
  Trash2,
  Activity,
  Stethoscope,
  FlaskConical,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import * as patientsService from '../../services/patientsService.js';
import * as prescriptionsService from '../../services/prescriptionsService.js';
import * as staffService from '../../services/staffService.js';
import { extractApiError } from '../../services/apiClient.js';
import { BLOOD_GROUPS } from '../../constants/patients.js';
import { PRESCRIPTIONS_WRITE_ROLES } from '../../constants/roles.js';
import { PageHeader } from '../../components/ui/page-header.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Spinner } from '../../components/ui/spinner.jsx';
import { Skeleton } from '../../components/ui/skeleton.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';

import LegalPrescriptionDocument from '../../components/prescriptions/LegalPrescriptionDocument.jsx';
import MedicineRxBuilder, { createEmptyMedicineItem } from '../../components/prescriptions/MedicineRxBuilder.jsx';
import DrugHistoryPanel, { DRUG_HISTORY_DRAG_TYPE } from '../../components/prescriptions/DrugHistoryPanel.jsx';
import VitalsEditor from '../../components/prescriptions/VitalsEditor.jsx';
import DiagnosisBuilder from '../../components/prescriptions/DiagnosisBuilder.jsx';
import InvestigationBuilder from '../../components/prescriptions/InvestigationBuilder.jsx';
import AdviceBuilder from '../../components/prescriptions/AdviceBuilder.jsx';
import ClinicalNotesEditor from '../../components/prescriptions/ClinicalNotesEditor.jsx';
import SharePrescriptionDialog from '../../components/prescriptions/SharePrescriptionDialog.jsx';
import RevisePrescriptionDialog from '../../components/prescriptions/RevisePrescriptionDialog.jsx';
import AddMedicineDialog from '../../components/prescriptions/AddMedicineDialog.jsx';
import SectionEditDialog from '../../components/prescriptions/SectionEditDialog.jsx';
import MsWordEditorBox from '../../components/prescriptions/MsWordEditorBox.jsx';
import FollowUpDialog from '../../components/prescriptions/FollowUpDialog.jsx';
import PatientInfoEditDialog from '../../components/prescriptions/PatientInfoEditDialog.jsx';
import { formatDate } from '../../lib/dateFormat.js';

// ---- Prescription date helpers --------------------------------------------
// The form keeps the date as a plain "YYYY-MM-DD" string (what <input type="date">
// speaks). It is only converted to an ISO timestamp when talking to the API, so
// back-dating (e.g. 5 Dec 2024) never shifts a day because of the timezone.
const pad2 = (n) => String(n).padStart(2, '0');
const toDateInput = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return toDateInput(null);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const dateInputToIso = (value) => {
  if (!value) return undefined;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  // Today -> "right now" (the API rejects future timestamps); any earlier day -> local noon.
  if (value === toDateInput(new Date())) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};
const toPayload = (f) => ({ ...f, prescriptionDate: dateInputToIso(f.prescriptionDate) });

// ---- Letterhead: built from the logged-in doctor's own profile -------------
const withDoctorTitle = (name, role) => {
  const n = (name || '').trim();
  if (!n) return '';
  return role === 'DOCTOR' && !/^(dr\.?|prof\.?|professor)\b/i.test(n) ? `Dr. ${n}` : n;
};
const buildDoctorSnapshotFromProfile = (user, staff) => {
  const dd = staff?.doctorDetails || {};
  return {
    name: withDoctorTitle(user?.name, user?.role),
    nameBangla: dd.nameBangla || '',
    degreesEnglish: (dd.qualifications || []).join(', '),
    degreesBangla: dd.degreesBangla || '',
    designationEnglish: dd.designationEnglish || '',
    designationBangla: dd.designationBangla || '',
    departmentEnglish: dd.departmentEnglish || staff?.department || '',
    departmentBangla: dd.departmentBangla || '',
    hospitalEnglish: dd.hospitalEnglish || '',
    hospitalBangla: dd.hospitalBangla || '',
    specialtyEnglish: dd.specialization || '',
    specialtyBangla: dd.specialtyBangla || '',
    registrationNumber: dd.registrationNumber || '',
    chamberInfo: dd.chamberInfo || '',
    visitingHours: dd.visitingHours || '',
    email: user?.email || '',
    phone: staff?.phone || '',
  };
};

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown', 'Not Tested'];

const initialPrescriptionState = {
  chiefComplaint: '',
  coMorbidities: '',
  pastHistory: '',
  personalHistory: '',
  onExamination: '',
  smokingHistory: '',
  menstrualHistory: '',
  drugHistory: '',
  vitals: {
    bloodPressure: { systolic: null, diastolic: null, unit: 'mm of Hg', recordedAt: new Date() },
    pulse: { value: null, unit: 'b/min', recordedAt: new Date() },
    weight: { value: null, unit: 'kg', recordedAt: new Date() },
    temperature: { value: null, unit: '°F', recordedAt: new Date() },
    spo2: { value: null, unit: '%', recordedAt: new Date() },
  },
  diagnoses: [],
  diagnosisSummary: '',
  items: [createEmptyMedicineItem(1)],
  investigations: [],
  investigation: '',
  pathologyAndImaging: '',
  advice: [],
  generalInstructions: '',
  investigationAdvice: '',
  testAdvices: '',
  nextFollowUp: { date: null, time: '', instruction: '', quickOption: '' },
  followUpDate: null,
  prescriptionDate: '',
  patientSnapshot: {},
  doctorSnapshot: {},
};

export default function PrescriptionWorkspacePage() {
  const { t } = useTranslation();
  const { patientProfileId, prescriptionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const isNew = !prescriptionId || prescriptionId === 'new';

  const [viewMode, setViewMode] = useState('pad'); // 'pad' (default interactive prescription pad) | 'split' | 'editor'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [patient, setPatient] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [form, setForm] = useState(initialPrescriptionState);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [previousPrescriptions, setPreviousPrescriptions] = useState([]);

  const autosaveTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const isFinalized = prescription?.status === 'FINALIZED' || prescription?.status === 'SUPERSEDED';
  const canWrite = PRESCRIPTIONS_WRITE_ROLES.includes(user?.role) && !isFinalized;

  // Callback ref to immediately measure container width when mounted or resized
  const previewContainerRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(rect.width);
      }
      const obs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width || entry.target.getBoundingClientRect().width;
          if (w > 0) {
            setContainerWidth(w);
          }
        }
      });
      obs.observe(node);
      observerRef.current = obs;
    }
  }, []);

  // Compute effective scale: if auto-fit, calculate exact scale to fit container width.
  // While actively writing (canWrite), never shrink below a comfortably-writable
  // size — a legal 8.5x14 page auto-fit to a half-width split panel used to
  // land around 45-55%, which is genuinely too small to click or type into
  // precisely. The preview container already scrolls both ways (see
  // `overflow-x-auto overflow-y-auto` below), so there's no need to shrink
  // the whole page to fit — scrolling a comfortably-sized page is how every
  // normal document editor handles this.
  const effectiveScale = useMemo(() => {
    const minScale = canWrite ? 0.85 : 0.35;
    const maxScale = canWrite ? 1.4 : 1.05;
    if (isAutoFit) {
      if (containerWidth > 0) {
        // 816px is 8.5in base width. 48px padding for comfortable side margins.
        const fit = Math.max(minScale, Math.min(maxScale, (containerWidth - 48) / 816));
        return Number(fit.toFixed(2));
      }
      return viewMode === 'preview' ? 0.85 : (canWrite ? 1.1 : 0.48);
    }
    return zoomLevel;
  }, [containerWidth, zoomLevel, isAutoFit, viewMode, canWrite]);

  // Load Patient Profile and Existing Prescription
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [patientData, pastList, myStaffProfile] = await Promise.all([
        patientsService.getPatient(patientProfileId),
        prescriptionsService.listPrescriptionsByPatient(patientProfileId),
        // Only needed for a brand-new prescription; non-staff accounts just get null.
        isNew ? staffService.getMyStaffProfile().catch(() => null) : Promise.resolve(null),
      ]);
      setPatient(patientData);
      setPreviousPrescriptions(pastList || []);

      if (isNew) {
        setPrescription(null);
        // Build initial patient snapshot from patient record
        const social = patientData.socialHistory || {};
        const smoking = social.smoking || {};
        const smokingSummaryParts = [];
        if (smoking.cigarettesPerDay) smokingSummaryParts.push(`${smoking.cigarettesPerDay}/day`);
        if (smoking.yearsSmoked) smokingSummaryParts.push(`${smoking.yearsSmoked} yrs`);
        if (smoking.packYears) smokingSummaryParts.push(`${smoking.packYears} pack-years`);
        const initialPatSnapshot = {
          name: patientData.fullName || `${patientData.firstName} ${patientData.lastName}`,
          patientId: patientData.patientId || '—',
          age: patientData.age || 40,
          ageFormatted: `${patientData.age || 40} Y`,
          gender: patientData.gender || 'FEMALE',
          bloodGroup: patientData.bloodGroup || 'Unknown',
          phone: patientData.phone || patientData.alternatePhone || '—',
          address: patientData.address ? `${patientData.address.street || ''} ${patientData.address.city || ''}`.trim() : '',
          visitNumber: (pastList?.length || 0) + 1,
          lastVisitDate: pastList?.[0]?.prescriptionDate || null,
          smokingStatus: social.smokingStatus || '',
          smokingSummary: smokingSummaryParts.join(', '),
        };

        setForm({
          ...initialPrescriptionState,
          patientSnapshot: initialPatSnapshot,
          prescriptionDate: toDateInput(new Date()),
          doctorSnapshot: buildDoctorSnapshotFromProfile(user, myStaffProfile),
        });
      } else {
        const existing = await prescriptionsService.getPrescription(prescriptionId);
        setPrescription(existing);
        setForm({
          chiefComplaint: existing.chiefComplaint || '',
          coMorbidities: existing.coMorbidities || '',
          pastHistory: existing.pastHistory || '',
          personalHistory: existing.personalHistory || '',
          onExamination: existing.onExamination || '',
          smokingHistory: existing.smokingHistory || '',
          menstrualHistory: existing.menstrualHistory || '',
          drugHistory: existing.drugHistory || '',
          vitals: existing.vitals || initialPrescriptionState.vitals,
          diagnoses: existing.diagnoses || [],
          diagnosisSummary: existing.diagnosisSummary || '',
          items: existing.items?.length ? existing.items : [createEmptyMedicineItem(1)],
          investigations: existing.investigations?.length ? existing.investigations : existing.labTests || [],
          investigation: existing.investigation || '',
          pathologyAndImaging: existing.pathologyAndImaging || '',
          advice: existing.advice || [],
          generalInstructions: existing.generalInstructions || '',
          investigationAdvice: existing.investigationAdvice || '',
          testAdvices: existing.testAdvices || '',
          nextFollowUp: existing.nextFollowUp || {},
          followUpDate: existing.followUpDate || null,
          prescriptionDate: toDateInput(existing.prescriptionDate),
          patientSnapshot: existing.patientSnapshot || {},
          doctorSnapshot: existing.doctorSnapshot || {},
        });
      }
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [patientProfileId, prescriptionId, isNew, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handlePrescriptionUpdated = () => {
      loadData({ silent: true });
    };
    window.addEventListener('prescription:updated', handlePrescriptionUpdated);
    return () => window.removeEventListener('prescription:updated', handlePrescriptionUpdated);
  }, [loadData]);

  // Form field updater with debounced autosave for drafts
  /**
   * Handles inline edits made directly on the prescription document
   * itself (LegalPrescriptionDocument in `editable` mode) — the
   * writing-surface requirement: doctors can click any writable area
   * of the Rx page and type there, in addition to the structured
   * builders below (ClinicalNotesEditor, MedicineRxBuilder), which
   * remain available for dropdown/preset-driven entry.
   */
  const handleDocumentEdit = ({ path, value, index, key, updates }) => {
    if (path === 'generalInstructions') return updateForm({ generalInstructions: value });
    if (path === 'testAdvices') return updateForm({ testAdvices: value });
    if (path === 'followUpInstruction') {
      return updateForm({ nextFollowUp: { ...(form.nextFollowUp || {}), instruction: value } });
    }
    if (path === 'item') {
      const items = [...(form.items || [])];
      items[index] = { ...(items[index] || {}), [key]: value };
      return updateForm({ items });
    }
    if (path === 'itemMerge') {
      const items = [...(form.items || [])];
      items[index] = { ...(items[index] || {}), ...updates };
      return updateForm({ items });
    }
    return undefined;
  };

  // Dialog states
  const [openSection, setOpenSection] = useState(null); // null | 'vitals' | 'diagnoses' | 'advice' | 'investigations'
  const [wordEditor, setWordEditor] = useState({
    open: false,
    sectionKey: '',
    title: '',
    initialValue: '',
  });
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [patientInfoOpen, setPatientInfoOpen] = useState(false);

  // Both "+ Add medicine line" (on the document) and picking a drug
  // from DrugHistoryPanel (drag or the + button) open the SAME
  // structured "New Medicine Item" dialog
  const [addMedicineDialogOpen, setAddMedicineDialogOpen] = useState(false);
  const [addMedicineInitialItem, setAddMedicineInitialItem] = useState(null);
  const [editingMedicineIndex, setEditingMedicineIndex] = useState(null);

  const handleAddItemFromDocument = () => {
    setEditingMedicineIndex(null);
    setAddMedicineInitialItem(null);
    setAddMedicineDialogOpen(true);
  };

  const handleEditItem = (item, index) => {
    if (!canWrite) return;
    setEditingMedicineIndex(index);
    setAddMedicineInitialItem(item);
    setAddMedicineDialogOpen(true);
  };

  const handleRemoveItem = (index) => {
    if (!canWrite) return;
    const next = (form.items || []).filter((_, i) => i !== index);
    updateForm({ items: next });
  };

  const handleOpenSection = (sectionKey) => {
    if (!canWrite) return;
    if (sectionKey === 'diagnoses') {
      setOpenSection('diagnoses');
      return;
    }
    if (sectionKey === 'nextVisit') {
      setFollowUpDialogOpen(true);
      return;
    }
    if (sectionKey === 'addMedicine') {
      handleAddItemFromDocument();
      return;
    }

    const titles = {
      chiefComplaint: 'Chief Complaint',
      coMorbidities: 'Co - Morbidities',
      pastHistory: 'Past History',
      personalHistory: 'Personal History',
      onExamination: 'On examination',
      vitals: 'On examination',
      smokingHistory: 'Smoking History',
      drugHistory: 'Drug History',
      menstrualHistory: 'Menstrual History',
      pathologyAndImaging: 'Pathology & imaging',
      investigation: 'Investigation / Test',
      investigations: 'Investigation / Test',
      advice: 'Advice ( উপদেশ )',
      investigationAdvice: 'Investigation advice',
      testAdvices: 'Test advice',
    };

    let effectiveKey = sectionKey;
    if (sectionKey === 'vitals') effectiveKey = 'onExamination';
    if (sectionKey === 'investigations') effectiveKey = 'investigation';

    let initialVal = form[effectiveKey] || form[sectionKey] || '';
    // form.advice (and potentially other fields) can be an array/object
    // rather than a string — e.g. form.advice defaults to `[]`, which is
    // truthy, so the `||` chain above never falls through to ''. That
    // non-string value then reached MsWordEditorBox's `content` state and
    // crashed on `content.trim()` (the "Advice" tab's "Something went
    // wrong" error). Section-specific handling below (onExamination,
    // investigation, advice) rebuilds the string as needed.
    if (typeof initialVal !== 'string') {
      initialVal = '';
    }
    if (effectiveKey === 'onExamination' && !initialVal) {
      const v = form.vitals || {};
      const parts = [];
      if (v.bloodPressure?.systolic && v.bloodPressure?.diastolic) {
        parts.push(`BP: ${v.bloodPressure.systolic}/${v.bloodPressure.diastolic} mm of Hg`);
      }
      if (v.pulse?.value) parts.push(`Pulse: ${v.pulse.value} b/min`);
      if (v.temperature?.value) parts.push(`Temp: ${v.temperature.value} °F`);
      if (v.weight?.value) parts.push(`Weight: ${v.weight.value} kg`);
      if (v.spo2?.value) parts.push(`SpO2: ${v.spo2.value} %`);
      if (parts.length > 0) initialVal = parts.map((p) => `• ${p}`).join('\n');
    }

    if (effectiveKey === 'investigation' && !initialVal) {
      if (Array.isArray(form.investigations) && form.investigations.length > 0) {
        initialVal = form.investigations
          .map((inv) => `• ${inv.testName || inv.name || ''}${inv.notes ? ` (${inv.notes})` : ''}`)
          .filter(Boolean)
          .join('\n');
      }
    }

    if (sectionKey === 'advice') {
      if (Array.isArray(form.advice) && form.advice.length > 0) {
        initialVal = form.advice.map((a) => (typeof a === 'string' ? a : a.text)).join('\n');
      } else if (typeof form.advice === 'string') {
        initialVal = form.advice;
      }
      if (form.generalInstructions) {
        initialVal = initialVal ? `${initialVal}\n${form.generalInstructions}` : form.generalInstructions;
      }
    }

    setWordEditor({
      open: true,
      sectionKey: effectiveKey,
      title: titles[sectionKey] || titles[effectiveKey] || 'Clinical Notes',
      initialValue: initialVal,
    });
  };

  const handleSaveWordEditor = (newText) => {
    const key = wordEditor.sectionKey;
    if (key === 'advice') {
      const lines = newText.split('\n').map((l) => l.trim()).filter(Boolean);
      updateForm({
        advice: lines.map((line, idx) => ({
          id: `adv_${Date.now()}_${idx}`,
          text: line.replace(/^[•\-\*]\s+/, '').replace(/^\d+\.\s*/, ''),
          displayOrder: idx + 1,
        })),
        generalInstructions: '',
      });
      return;
    }
    if (key === 'investigation' || key === 'investigations') {
      updateForm({ investigation: newText });
      return;
    }
    if (key === 'onExamination' || key === 'vitals') {
      updateForm({ onExamination: newText });
      return;
    }
    updateForm({ [key]: newText });
  };

  const handleOpenPatientEdit = () => {
    if (!canWrite) return;
    setPatientInfoOpen(true);
  };

  const handleSavePatientInfo = (updated) => {
    updateForm({
      patientSnapshot: {
        ...(form.patientSnapshot || {}),
        ...updated,
      },
    });
    toast({
      title: 'Patient details updated on prescription',
      variant: 'success',
    });
  };

  /**
   * Turns a drug pulled from DrugHistoryPanel (drag or the + button)
   * into a prefilled draft, opened in the same AddMedicineDialog used
   * for a blank line
   */
  const handleAddDrugFromHistory = (drug) => {
    if (!drug) return;
    const { _id, id, lastPrescribedAt, ...rest } = drug;
    setEditingMedicineIndex(null);
    setAddMedicineInitialItem(rest);
    setAddMedicineDialogOpen(true);
  };

  /** Confirmed from AddMedicineDialog */
  const handleConfirmAddMedicine = (draftItem) => {
    if (editingMedicineIndex !== null) {
      const nextItems = [...(form.items || [])];
      nextItems[editingMedicineIndex] = {
        ...nextItems[editingMedicineIndex],
        ...draftItem,
        serialNumber: editingMedicineIndex + 1,
        displayOrder: editingMedicineIndex + 1,
      };
      updateForm({ items: nextItems });
      setEditingMedicineIndex(null);
    } else {
      const serialNumber = (form.items?.length || 0) + 1;
      updateForm({
        items: [...(form.items || []), { ...draftItem, serialNumber, displayOrder: serialNumber }],
      });
    }
  };

  /** Shared drop handler for both drop targets below (the structured
   * MedicineRxBuilder panel and the live Rx document itself) — reads
   * the drug-history drag payload and opens the same review dialog
   * the + button does. */
  const handleDrugDrop = (e) => {
    const raw = e.dataTransfer.getData(DRUG_HISTORY_DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    try {
      handleAddDrugFromHistory(JSON.parse(raw));
    } catch {
      // malformed payload — ignore rather than throw mid-drag
    }
  };

  const handleDrugDragOver = (e) => {
    if (e.dataTransfer.types.includes(DRUG_HISTORY_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const updateForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };

      // Trigger debounced autosave if not finalized and editing an existing draft
      if (canWrite && prescription && !isNew && prescription.status === 'DRAFT') {
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        setAutosaveStatus('saving');
        autosaveTimeoutRef.current = setTimeout(() => {
          prescriptionsService
            .updatePrescription(prescription.id || prescription._id, toPayload(next))
            .then(() => {
              setAutosaveStatus('saved');
              setTimeout(() => setAutosaveStatus('idle'), 2500);
            })
            .catch(() => setAutosaveStatus('idle'));
        }, 1500);
      }

      return next;
    });
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const created = await prescriptionsService.createPrescription(patientProfileId, toPayload(form));
        toast({
          title: t('clinical.prescription.draftSavedToast', 'Prescription Draft Saved'),
          description: `Prescription ID: ${created.prescriptionId}`,
          variant: 'success',
        });
        navigate(`/dashboard/patients/${patientProfileId}/prescriptions/${created.id || created._id}/edit`, {
          replace: true,
        });
      } else {
        const updated = await prescriptionsService.updatePrescription(prescription.id || prescription._id, toPayload(form));
        setPrescription(updated);
        toast({
          title: t('clinical.prescription.draftSavedToast', 'Prescription Draft Updated'),
          variant: 'success',
        });
      }
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  // Finalize Handler
  const handleFinalize = async () => {
    const ok = await confirm({
      title: t('clinical.prescription.finalizeConfirmTitle', 'Finalize & Lock Prescription?'),
      description: t(
        'clinical.prescription.finalizeConfirmDescription',
        'Once finalized, this prescription becomes a locked clinical medical record. Any subsequent corrections will create a versioned revision.',
      ),
      confirmLabel: t('clinical.prescription.finalize', 'Finalize Prescription'),
    });
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      let currentId = prescription?.id || prescription?._id;
      if (isNew) {
        const created = await prescriptionsService.createPrescription(patientProfileId, toPayload(form));
        currentId = created.id || created._id;
      } else {
        await prescriptionsService.updatePrescription(currentId, toPayload(form));
      }

      const finalized = await prescriptionsService.finalizePrescription(currentId);
      setPrescription(finalized);
      toast({
        title: t('clinical.prescription.finalizedToast', 'Prescription Finalized Successfully'),
        description: `Prescription ${finalized.prescriptionId} is now locked and ready for print/download.`,
        variant: 'success',
      });
      navigate(`/dashboard/patients/${patientProfileId}/prescriptions/${finalized.id || finalized._id}/edit`, {
        replace: true,
      });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Download PDF Handler
  const handleDownloadPdf = async () => {
    const idToUse = prescription?.id || prescription?._id;
    if (!idToUse) {
      toast({ title: 'Please save draft or finalize before downloading PDF', variant: 'warning' });
      return;
    }
    try {
      const blobUrl = await prescriptionsService.getPrescriptionPdfBlobUrl(idToUse);
      const patName = form.patientSnapshot?.name || patient?.fullName || 'Patient';
      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Ash-Shafi_Prescription_${patName.replace(/\s+/g, '_')}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast({ title: 'Failed to download PDF', description: extractApiError(err).message, variant: 'destructive' });
    }
  };

  // Copy From Previous Prescription Handler
  const handleCopyFromPrevious = async (prevId) => {
    try {
      const clonedDraft = await prescriptionsService.copyPrescription(prevId);
      toast({ title: 'Copied from previous prescription!', variant: 'success' });
      navigate(`/dashboard/patients/${patientProfileId}/prescriptions/${clonedDraft.id || clonedDraft._id}/edit`);
    } catch (err) {
      toast({ title: 'Failed to copy prescription', description: extractApiError(err).message, variant: 'destructive' });
    }
  };

  const handleDiscardDraft = async () => {
    const ok = await confirm({
      title: t('clinical.prescription.discardDraftTitle', 'Discard this prescription draft?'),
      description: t(
        'clinical.prescription.discardDraftDesc',
        'This will permanently delete this unfinalized prescription draft. This action cannot be undone.',
      ),
      confirmLabel: t('clinical.prescription.discardDraft', 'Yes, discard draft'),
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      if (prescriptionId && prescriptionId !== 'new') {
        await prescriptionsService.deletePrescription(prescriptionId);
      }
      toast({ title: t('clinical.prescription.draftDiscarded', 'Prescription draft discarded'), variant: 'success' });
      navigate(`/dashboard/patients/${patientProfileId}?tab=prescriptions`);
    } catch (err) {
      toast({ title: 'Failed to discard draft', description: extractApiError(err).message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  const patientName = patient?.fullName || `${patient?.firstName || ''} ${patient?.lastName || ''}`;

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen pb-16 space-y-4 prescription-workspace-root">
      {/* Top Breadcrumb & PageHeader */}
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('nav.patients', 'Patients'), to: '/dashboard/patients' },
          { label: patientName, to: `/dashboard/patients/${patientProfileId}?tab=prescriptions` },
          { label: isNew ? t('clinical.prescription.newPrescription', 'New Prescription') : prescription?.prescriptionId || t('clinical.prescription.editPrescription', 'Prescription') },
        ]}
        title={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-bold text-lg sm:text-xl text-foreground">
              {isNew ? t('clinical.prescription.newPrescription', 'Prescription Workspace') : `${prescription?.prescriptionId || 'Prescription'}`}
            </span>
            {isFinalized ? (
              <Badge variant="success" className="gap-1 font-semibold text-xs">
                <FileCheck size={13} /> {t('clinical.prescription.statusFinalized', 'FINALIZED')}
              </Badge>
            ) : (
              <Badge variant="warning" className="font-semibold text-xs">
                {t('clinical.prescription.statusDraft', 'DRAFT')}
              </Badge>
            )}
            {autosaveStatus === 'saving' ? (
              <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
            ) : autosaveStatus === 'saved' ? (
              <span className="text-xs text-emerald-600 font-medium">All changes saved</span>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher (Prescription Pad | Split Workspace | Form Only) */}
            <div className="inline-flex items-center rounded-xl border border-border bg-card p-0.5 shadow-xs">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  viewMode === 'pad' ? 'bg-primary text-primary-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode('pad')}
              >
                <FileText size={13} className="inline mr-1" /> Prescription Pad
              </button>
              <button
                type="button"
                className={`hidden lg:inline-flex items-center px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  viewMode === 'split' ? 'bg-primary text-primary-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode('split')}
              >
                <Columns size={13} className="inline mr-1" /> Split Workspace
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  viewMode === 'editor' ? 'bg-primary text-primary-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setViewMode('editor')}
              >
                <Edit3 size={13} className="inline mr-1" /> Form Only
              </button>
            </div>

            {/* Previous Prescriptions Copy Dropdown */}
            {previousPrescriptions.length > 0 && !isFinalized ? (
              <div className="relative group">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Copy size={13} /> {t('clinical.prescription.copyPrevious', 'Copy Previous')}
                </Button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-40 w-64 rounded-xl border border-border bg-card shadow-xl p-1 divide-y divide-border">
                  {previousPrescriptions.slice(0, 4).map((p) => (
                    <button
                      key={p.id || p._id}
                      type="button"
                      className="w-full text-left p-2 rounded-lg text-xs hover:bg-accent flex items-center justify-between"
                      onClick={() => handleCopyFromPrevious(p.id || p._id)}
                    >
                      <div>
                        <p className="font-semibold">{p.prescriptionId || 'Prescription'}</p>
                        <p className="text-muted-foreground text-[11px]">{formatDate(p.prescriptionDate)}</p>
                      </div>
                      <Badge variant="neutral" className="text-[10px]">{p.items?.length || 0} meds</Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Save Draft & Finalize Buttons */}
            {canWrite && !isFinalized ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardDraft}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  title="Discard this draft"
                >
                  <Trash2 size={14} /> {t('clinical.prescription.discard', 'Discard Draft')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="gap-1.5">
                  <Save size={14} /> {saving ? t('common.saving', 'Saving...') : t('clinical.prescription.saveDraft', 'Save Draft')}
                </Button>
                <Button type="button" size="sm" onClick={handleFinalize} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  <CheckCircle2 size={14} /> {t('clinical.prescription.finalize', 'Finalize Prescription')}
                </Button>
              </>
            ) : null}

            {isFinalized && PRESCRIPTIONS_WRITE_ROLES.includes(user?.role) ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setReviseOpen(true)} className="gap-1.5">
                <Edit3 size={14} /> {t('clinical.prescription.revise', 'Revise (Create v2)')}
              </Button>
            ) : null}

            {/* Quick Export Tools */}
            <div className="flex items-center gap-1 border-l border-border/80 pl-1.5 ml-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handlePrint} title="Print">
                <Printer size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleDownloadPdf} title="Download PDF">
                <Download size={15} />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShareOpen(true)} title="Share">
                <Share2 size={15} />
              </Button>
            </div>
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle size={15} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Patient Demographic Information Banner with Blood Group Dropdown */}
      <div className="rounded-2xl border border-border bg-card/80 p-3 sm:p-4 shadow-sm backdrop-blur-xs space-y-3 w-full max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {patient?.firstName?.[0] || 'P'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight truncate">{patientName}</h2>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {patient?.patientId} • {patient?.gender} • {form.patientSnapshot?.ageFormatted || `${patient?.age || '—'} Y`}
              </p>
            </div>
          </div>

          {/* Prescription date — defaults to today, can be back-dated (e.g. a visit from 5 Dec 2024) */}
          <div className="flex items-center gap-2">
            <label htmlFor="rx-date" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar size={13} /> {t('clinical.prescription.date', 'Prescription date')}:
            </label>
            <input
              id="rx-date"
              type="date"
              disabled={!canWrite}
              max={toDateInput(new Date())}
              value={form.prescriptionDate || ''}
              onChange={(e) => {
                // Ignore a cleared field so the prescription never ends up undated.
                if (e.target.value) updateForm({ prescriptionDate: e.target.value });
              }}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
            />
            {form.prescriptionDate && form.prescriptionDate !== toDateInput(new Date()) ? (
              <Badge variant="warning" className="text-[10px] font-semibold">
                {t('clinical.prescription.backdated', 'Back-dated')}
              </Badge>
            ) : null}
          </div>

          {/* Blood Group Dropdown Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t('clinical.fields.bloodGroup', 'Blood Group')}:</span>
            <select
              disabled={!canWrite}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-bold text-rose-700 dark:text-rose-400 focus:outline-none"
              value={form.patientSnapshot?.bloodGroup || patient?.bloodGroup || 'Unknown'}
              onChange={(e) => {
                const bg = e.target.value;
                updateForm({
                  patientSnapshot: {
                    ...form.patientSnapshot,
                    bloodGroup: bg,
                  },
                });
              }}
            >
              {BLOOD_GROUP_OPTIONS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick details strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <div><span className="font-semibold text-foreground">Phone:</span> {patient?.phone || '—'}</div>
          <div><span className="font-semibold text-foreground">Visit Number:</span> #{form.patientSnapshot?.visitNumber || 1}</div>
          <div><span className="font-semibold text-foreground">Last Visit:</span> {form.patientSnapshot?.lastVisitDate ? formatDate(form.patientSnapshot.lastVisitDate) : 'First Visit'}</div>
          <div><span className="font-semibold text-foreground">Prescription ID:</span> <span className="font-mono font-bold text-primary">{prescription?.prescriptionId || 'Generated on save'}</span></div>
        </div>
      </div>

      {/* Main Content Workspace: Responsive Dual-Pane with Zero Horizontal Overflow */}
      <div
        className={`grid gap-6 w-full max-w-full ${
          viewMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]'
            : 'grid-cols-1'
        }`}
      >
        {/* LEFT PANE: PRESCRIPTION EDITOR */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div className="space-y-6 min-w-0 w-full max-w-full overflow-hidden">
            {/* 1. Clinical Notes (Chief Complaint, Co-Morbidities, Past History, etc.) */}
            <div data-voice-section="clinicalNotes" className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm space-y-4">
              <ClinicalNotesEditor
                form={form}
                onChange={updateForm}
                onOpenModal={handleOpenSection}
                disabled={!canWrite}
              />
            </div>

            {/* 2. On Examinations / Vitals */}
            <div data-voice-section="vitals" className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm">
              <VitalsEditor
                value={form.vitals}
                onChange={(vitals) => updateForm({ vitals })}
                disabled={!canWrite}
              />
            </div>

            {/* Personal / Smoking history — read-only summary sourced from the
                patient's profile (edited on the patient's Medical History tab);
                snapshotted into patientSnapshot.smokingStatus/smokingSummary at
                creation time so this prescription's record never changes later. */}
            {form.patientSnapshot?.smokingStatus && form.patientSnapshot.smokingStatus !== 'UNKNOWN' ? (
              <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border pb-1.5 mb-2">
                  <span>Smoking history</span>
                  <span className="text-[10px] font-medium uppercase text-muted-foreground">
                    {form.patientSnapshot.smokingStatus}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.patientSnapshot.smokingSummary || 'No structured detail recorded.'}
                </p>
              </div>
            ) : null}

            {/* 3. Diagnosis Builder */}
            <div data-voice-section="diagnosis" className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm">
              <DiagnosisBuilder
                diagnoses={form.diagnoses}
                onChange={(diagnoses) => updateForm({ diagnoses })}
                disabled={!canWrite}
              />
            </div>

            {/* Drug History — previously prescribed drugs for this patient,
                each draggable or one-tap-addable into the Rx below or the
                live document on the right. */}
            <DrugHistoryPanel
              previousPrescriptions={previousPrescriptions}
              onAddDrug={handleAddDrugFromHistory}
              disabled={!canWrite}
            />

            {/* 4. Medicine / Rx Builder (CORE) */}
            <div
              data-voice-section="medicines"
              className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm"
              onDragOver={handleDrugDragOver}
              onDrop={handleDrugDrop}
            >
              <MedicineRxBuilder
                items={form.items}
                onChange={(items) => updateForm({ items })}
                disabled={!canWrite}
              />
            </div>

            {/* 5. Investigation / Tests Builder */}
            <div data-voice-section="investigations" className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm">
              <InvestigationBuilder
                investigations={form.investigations}
                onChange={(investigations) => updateForm({ investigations, labTests: investigations })}
                disabled={!canWrite}
              />
            </div>

            {/* 6. Advice Builder */}
            <div data-voice-section="advice" className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm">
              <AdviceBuilder
                advice={form.advice}
                onChange={(advice) => updateForm({ advice })}
                disabled={!canWrite}
              />
            </div>
          </div>
        )}

        {/* RIGHT PANE / CENTERED PAD: LIVE LEGAL 8.5" × 14" PRESCRIPTION CANVAS */}
        {(viewMode === 'split' || viewMode === 'pad' || viewMode === 'preview') && (
          <div className="min-w-0 w-full max-w-full flex flex-col items-center">
            <div className="sticky top-20 w-full flex flex-col items-center min-w-0">
              {/* Preview Header Banner with Zoom Controls */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-border text-xs text-muted-foreground">
                <span className="font-bold flex items-center gap-1.5 text-foreground">
                  <Eye size={14} className="text-primary" /> Prescription Pad Canvas (Legal 8.5" × 14")
                </span>
                <div className="flex items-center gap-1.5">
                  {/* Auto-Fit / Reset Toggle */}
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-all ${
                      isAutoFit
                        ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    }`}
                    onClick={() => {
                      setIsAutoFit(true);
                    }}
                    title="Automatically fit preview to window width"
                  >
                    <Maximize2 size={11} className="inline mr-1" /> Fit
                  </button>

                  {/* Zoom Controls */}
                  <div className="flex items-center rounded-lg border border-border bg-card px-1 py-0.5 text-xs">
                    <button
                      type="button"
                      className="px-1.5 py-0.5 hover:text-foreground font-bold"
                      onClick={() => {
                        setIsAutoFit(false);
                        setZoomLevel(Math.max(0.35, Number((effectiveScale - 0.05).toFixed(2))));
                      }}
                      title="Zoom Out"
                    >
                      −
                    </button>
                    <span className="px-1 font-mono text-[11px] min-w-[36px] text-center">
                      {Math.round(effectiveScale * 100)}%
                    </span>
                    <button
                      type="button"
                      className="px-1.5 py-0.5 hover:text-foreground font-bold"
                      onClick={() => {
                        setIsAutoFit(false);
                        setZoomLevel(Math.min(2, Number((effectiveScale + 0.05).toFixed(2))));
                      }}
                      title="Zoom In"
                    >
                      +
                    </button>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] hidden sm:inline-flex">Paper: LEGAL 8.5 × 14 in</Badge>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handlePrint} title="Print">
                    <Printer size={13} />
                  </Button>
                </div>
              </div>

              {/* Scrollable Container with scaled Legal page */}
              <div
                ref={previewContainerRef}
                className="w-full max-w-full max-h-[85vh] overflow-x-auto overflow-y-auto p-3 sm:p-4 flex justify-center bg-slate-900/5 dark:bg-slate-950/40 rounded-2xl border border-border/80"
                onDragOver={handleDrugDragOver}
                onDrop={handleDrugDrop}
              >
                <LegalPrescriptionDocument
                  prescription={{
                    ...form,
                    id: prescription?.id || prescription?._id || 'DRAFT-PREVIEW',
                    prescriptionId: prescription?.prescriptionId || 'RX-2026-000001',
                    prescriptionDate: dateInputToIso(form.prescriptionDate) || prescription?.prescriptionDate || new Date(),
                    verificationToken: prescription?.verificationToken || 'DEMO-TOKEN-2026',
                  }}
                  scale={effectiveScale}
                  editable={canWrite}
                  onOpenSection={handleOpenSection}
                  onOpenPatientEdit={handleOpenPatientEdit}
                  onAddItem={handleAddItemFromDocument}
                  onEditItem={handleEditItem}
                  onRemoveItem={handleRemoveItem}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Dialog */}
      <SharePrescriptionDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        prescription={prescription || { ...form, prescriptionId: 'DRAFT', verificationToken: 'preview' }}
      />

      {/* Revise Dialog */}
      {prescription ? (
        <RevisePrescriptionDialog
          open={reviseOpen}
          onOpenChange={setReviseOpen}
          prescription={prescription}
          onRevised={(revision) => {
            setPrescription(revision);
            navigate(`/dashboard/patients/${patientProfileId}/prescriptions/${revision.id || revision._id}/edit`);
          }}
        />
      ) : null}

      {/* Add Medicine Dialog — the single structured entry point for
          adding a medicine, whether from "+ Add medicine line" on the
          document or a pick from Drug History. */}
      <AddMedicineDialog
        open={addMedicineDialogOpen}
        onOpenChange={setAddMedicineDialogOpen}
        initialItem={addMedicineInitialItem}
        onAdd={handleConfirmAddMedicine}
        nextSerialNumber={(form.items?.length || 0) + 1}
      />

      {/* Vitals / Diagnoses / Advice / Investigations — each opened by
          clicking the matching section on the live Rx document,
          wrapping the exact same builder used in the left-panel
          editor, live-bound to `form`. */}
      <SectionEditDialog
        open={openSection === 'vitals'}
        onOpenChange={(v) => setOpenSection(v ? 'vitals' : null)}
        icon={<Activity size={18} />}
        title="On Examinations / Vitals"
      >
        <VitalsEditor
          value={form.vitals}
          onChange={(vitals) => updateForm({ vitals })}
          disabled={!canWrite}
        />
      </SectionEditDialog>

      <SectionEditDialog
        open={openSection === 'diagnoses'}
        onOpenChange={(v) => setOpenSection(v ? 'diagnoses' : null)}
        icon={<Stethoscope size={18} />}
        title="Diagnoses"
      >
        <DiagnosisBuilder
          diagnoses={form.diagnoses}
          onChange={(diagnoses) => updateForm({ diagnoses })}
          disabled={!canWrite}
        />
      </SectionEditDialog>

      <SectionEditDialog
        open={openSection === 'advice'}
        onOpenChange={(v) => setOpenSection(v ? 'advice' : null)}
        icon={<MessageSquare size={18} />}
        title="Advice (উপদেশ)"
      >
        <AdviceBuilder
          advice={form.advice}
          onChange={(advice) => updateForm({ advice })}
          disabled={!canWrite}
        />
      </SectionEditDialog>

      <SectionEditDialog
        open={openSection === 'investigations'}
        onOpenChange={(v) => setOpenSection(v ? 'investigations' : null)}
        icon={<FlaskConical size={18} />}
        title="Investigations / Tests"
      >
        <InvestigationBuilder
          investigations={form.investigations}
          onChange={(investigations) => updateForm({ investigations, labTests: investigations })}
          disabled={!canWrite}
        />
      </SectionEditDialog>

      {/* MS Word-Style Editor Box for custom writing sections */}
      <MsWordEditorBox
        open={wordEditor.open}
        onOpenChange={(open) => setWordEditor((prev) => ({ ...prev, open }))}
        title={wordEditor.title}
        sectionKey={wordEditor.sectionKey}
        initialValue={wordEditor.initialValue}
        onSave={handleSaveWordEditor}
      />

      {/* Patient Demographic Info Edit Dialog (Name, Blood Group, Phone, Age) */}
      <PatientInfoEditDialog
        open={patientInfoOpen}
        onOpenChange={setPatientInfoOpen}
        initialData={form.patientSnapshot || {}}
        onSave={handleSavePatientInfo}
      />

      {/* Follow-Up Visit Dialog */}
      <FollowUpDialog
        open={followUpDialogOpen}
        onOpenChange={setFollowUpDialogOpen}
        initialDate={form.nextFollowUp?.date || form.followUpDate}
        initialInstruction={form.nextFollowUp?.instruction}
        onSave={({ date, instruction }) => {
          updateForm({
            nextFollowUp: {
              ...(form.nextFollowUp || {}),
              date,
              instruction,
            },
            followUpDate: date,
          });
        }}
      />
    </div>
  );
}
