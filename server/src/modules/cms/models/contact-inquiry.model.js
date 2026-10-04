import mongoose from 'mongoose';

/**
 * FET-16 — public website "Contact" page form submission (master
 * prompt: "Public forms"). Deliberately its own small collection
 * rather than piggy-backing on any clinical/appointment model — a
 * contact inquiry is anonymous marketing-site correspondence, not a
 * patient record, and must never be confused with one (no
 * `patientProfileId`, no clinical fields, nothing that would put this
 * under the PHI/audit rules the rest of the system enforces for real
 * patient data).
 *
 * Every field is public-submitted input, so `sanitizeHtmlContent`
 * (the same helper `page.service.js` already uses for CMS content) is
 * applied to `message` in `contact.service.js` before persistence —
 * this model only bounds length.
 */
const CONTACT_INQUIRY_STATUSES = Object.freeze(['NEW', 'READ', 'RESOLVED']);

const contactInquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    subject: { type: String, trim: true, maxlength: 150, default: '' },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    status: { type: String, enum: CONTACT_INQUIRY_STATUSES, default: 'NEW', index: true },

    // Best-effort provenance, never trusted for anything security-
    // sensitive — same caveat as any client-supplied header.
    ipAddress: { type: String, trim: true, maxlength: 64, default: '' },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

contactInquirySchema.index({ status: 1, createdAt: -1 });

export const CONTACT_INQUIRY_STATUS_VALUES = CONTACT_INQUIRY_STATUSES;

export const ContactInquiry = mongoose.model(
  'ContactInquiry',
  contactInquirySchema,
  'website_contact_inquiries',
);
