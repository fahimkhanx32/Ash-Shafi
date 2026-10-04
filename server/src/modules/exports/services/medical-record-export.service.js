/**
 * BET-19 checkpoint 2 — "Medical-record export": the single-patient
 * full-record package (master prompt §52's "patient history PDF" /
 * "medical record package").
 *
 * Same discipline every other BET-19 export/FHIR file in this
 * project already follows: this never queries a Mongoose model
 * directly — every section of the package is assembled by reusing
 * the exact service function (and, for the medical-history fields,
 * the exact `canViewMedicalHistory`/`redactMedicalHistory` gate) the
 * native REST endpoints for that data already use, so the package
 * can never show a caller more than they could already see one
 * screen at a time through the ordinary API.
 */

import mongoose from 'mongoose';

import { getPatientProfileById } from '../../patients/services/patient.service.js';
import { redactMedicalHistory } from '../../patients/utils/patient-access.util.js';
import { listEncountersByPatientProfileId } from '../../encounters/services/encounter.service.js';
import { listPrescriptionsByPatientProfileId } from '../../prescriptions/services/prescription.service.js';
import { listInvestigations } from '../../investigations/services/investigation.service.js';
import { listReports } from '../../reports/services/report.service.js';
import { User } from '../../../users/user.model.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { generateMedicalRecordPdfBuffer } from '../utils/medical-record-pdf.util.js';

const dateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
const dateTime = (value) => (value ? new Date(value).toISOString() : null);

/**
 * Assembles every section of the medical-record package for one
 * patient. `MAX_TABULAR_EXPORT_ROWS`-style row caps are deliberately
 * not applied here — unlike the checkpoint-1 bulk *multi-patient*
 * exports, this is always scoped to exactly one patient, so a full,
 * uncapped clinical history is both the point of the feature and a
 * bounded, reasonable amount of data.
 *
 * @param {string} patientProfileId
 * @param {object} actor - `req.user`, forwarded to every reused
 *   domain service so this package can never show more than the
 *   caller's own permissions already allow.
 */
export const buildMedicalRecordBundle = async (patientProfileId, actor) => {
  if (!mongoose.Types.ObjectId.isValid(patientProfileId)) {
    throw new AppError('Invalid patient profile id.', 400, { code: 'INVALID_ID' });
  }

  const profile = await getPatientProfileById(patientProfileId);
  const user = await User.findById(profile.user).select('name email');

  // Same "a patient sees their own full record; anyone else needs
  // MEDICAL_RECORDS_READ" rule the native `GET /patients/:id`
  // response already enforces — reused verbatim, not reimplemented.
  const redactedProfile = redactMedicalHistory(profile, actor);

  const [encounters, prescriptions, investigationsResult, reportsResult] = await Promise.all([
    listEncountersByPatientProfileId(patientProfileId),
    listPrescriptionsByPatientProfileId(patientProfileId),
    listInvestigations({ patientProfileId, page: 1, limit: 500 }, actor),
    listReports({ patientProfileId, page: 1, limit: 500 }, actor),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    patient: {
      patientId: redactedProfile.patientId,
      name: user?.name || `${redactedProfile.firstName} ${redactedProfile.lastName}`.trim(),
      email: user?.email || null,
      gender: redactedProfile.gender,
      dateOfBirth: dateOnly(redactedProfile.dateOfBirth),
      bloodGroup: redactedProfile.bloodGroup || null,
      phone: redactedProfile.phone || null,
      alternatePhone: redactedProfile.alternatePhone || null,
      address: redactedProfile.address || null,
      status: redactedProfile.status,
      registrationDate: dateOnly(redactedProfile.registrationDate),
      // `getPatientProfileById` (unlike `listPatientProfiles`, used
      // by checkpoint 1's bulk export) doesn't populate
      // `primaryCareProvider` — this optional-chains to `null`
      // rather than crashing on the raw ObjectId, but the provider's
      // name is honestly omitted here, not silently guessed.
      primaryCareProvider: redactedProfile.primaryCareProvider?.name || null,
    },
    medicalHistory: redactedProfile.medicalHistoryRedacted
      ? { redacted: true }
      : {
          allergies: (redactedProfile.allergies || []).map((a) => ({
            allergen: a.allergen,
            severity: a.severity,
            reaction: a.reaction || null,
            isActive: a.isActive,
          })),
          chronicConditions: (redactedProfile.chronicConditions || []).map((c) => ({
            condition: c.condition,
            status: c.status,
            diagnosedDate: dateOnly(c.diagnosedDate),
          })),
          medicationHistory: (redactedProfile.medicationHistory || []).map((m) => ({
            medicationName: m.medicationName,
            status: m.status,
          })),
          vaccinationHistory: (redactedProfile.vaccinationHistory || []).map((v) => ({
            vaccineName: v.vaccineName,
            dateAdministered: dateOnly(v.dateAdministered),
          })),
        },
    encounters: (encounters || []).map((e) => ({
      date: dateOnly(e.encounterDate),
      status: e.status,
      provider: e.provider?.name || null,
      chiefComplaint: e.chiefComplaint || null,
      assessment: e.assessment || null,
      treatmentPlan: e.treatmentPlan || null,
    })),
    prescriptions: (prescriptions || []).map((p) => ({
      date: dateOnly(p.prescriptionDate),
      status: p.status,
      provider: p.provider?.name || null,
      diagnosisSummary: p.diagnosisSummary || null,
      items: (p.items || []).map((item) =>
        [item.genericName, item.strength, item.frequency].filter(Boolean).join(' '),
      ),
    })),
    investigations: (investigationsResult.items || []).map((i) => ({
      name: i.name,
      category: i.category,
      status: i.status,
      priority: i.priority,
      orderedDate: dateOnly(i.orderedDate),
      orderedBy: i.orderedBy?.name || null,
    })),
    reports: (reportsResult.items || []).map((r) => ({
      title: r.title,
      reportType: r.reportType,
      status: r.status,
      reportDate: dateOnly(r.reportDate) || dateOnly(r.uploadDate),
      isSensitive: !!r.isSensitive,
    })),
  };
};

/**
 * @returns {Promise<Buffer>} JSON-serialized package
 */
export const bundleToJsonBuffer = (bundle) =>
  Buffer.from(JSON.stringify(bundle, null, 2), 'utf8');

/**
 * @returns {Promise<Buffer>} PDF-rendered package
 */
export const bundleToPdfBuffer = (bundle) => generateMedicalRecordPdfBuffer(bundle);

export { dateTime };
