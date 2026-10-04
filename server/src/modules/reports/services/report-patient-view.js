/**
 * Patient-facing projection of a MedicalReport.
 *
 * A patient must see their submission, its status, whether it is verified,
 * and the machine-read text of their OWN document — but never internal
 * fields (storage/Cloudinary ids, history with staff user ids, routing
 * lists, duplicate-report ids, amendment history) and never clinical
 * content that has not been released: parameters and interpretation are
 * shown only once the report is FINALIZED/AMENDED.
 *
 * Machine-extracted text is always labelled as such until a clinician has
 * verified the report.
 */

const RELEASED_STATUSES = ['FINALIZED', 'AMENDED'];
const VERIFIED_STATUSES = ['VERIFIED', 'FINALIZED', 'AMENDED'];

const id = (value) => (value?._id ?? value) ?? null;

export const toPatientView = (report) => {
  if (!report) return report;
  const r = typeof report.toObject === 'function' ? report.toObject() : report;

  const released = RELEASED_STATUSES.includes(r.status);
  const verified = VERIFIED_STATUSES.includes(r.status) && r.verification?.status === 'VERIFIED';

  const view = {
    _id: r._id,
    reportReference: r.reportReference,
    reportType: r.reportType,
    documentSubType: r.documentSubType ?? null,
    title: r.title,
    reportDate: r.reportDate ?? null,
    uploadDate: r.uploadDate,
    performingFacility: r.performingFacility || '',
    status: r.status,
    verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
    verifiedAt: verified ? r.verification?.verifiedAt ?? null : null,
    rejectionReason: r.status === 'REJECTED' ? r.rejectionReason || r.submission?.reviewNote || '' : '',
    submission: r.submission
      ? {
          source: r.submission.source,
          patientNote: r.submission.patientNote || '',
          targetDoctor: id(r.submission.targetDoctor),
          intakeStatus: r.submission.intakeStatus ?? null,
          reviewedAt: r.submission.reviewedAt ?? null,
          reviewNote: r.submission.reviewNote || '',
        }
      : null,
    originalDocument: r.originalDocument
      ? {
          originalFilename: r.originalDocument.originalFilename,
          mimeType: r.originalDocument.mimeType,
          sizeBytes: r.originalDocument.sizeBytes,
          pageCount: r.originalDocument.pageCount ?? null,
        }
      : null,
    ocr: {
      status: r.extraction?.status ?? 'NOT_STARTED',
      confidence: r.extraction?.confidence ?? null,
      // Text is whatever the machine read from the patient's own file; it
      // is labelled until a clinician verifies the report.
      text: r.extraction?.extractedText || '',
      label: verified ? 'REVIEWED' : 'MACHINE_EXTRACTED_UNVERIFIED',
    },
  };

  if (released) {
    view.parameters = (r.parameters || []).map((p) => ({
      name: p.name,
      value: p.value,
      unit: p.unit ?? null,
      referenceRange: p.referenceRange ?? null,
      abnormalFlag: p.abnormalFlag,
    }));
    view.interpretation = r.interpretation || '';
  }

  return view;
};
