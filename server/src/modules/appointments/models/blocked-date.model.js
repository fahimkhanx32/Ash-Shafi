import mongoose from 'mongoose';

/**
 * BET-10.7 — Holidays & Blocked Dates.
 *
 * `doctor: null` = a clinic-wide holiday (applies to every doctor's
 * availability). `doctor: <ObjectId>` = a doctor-specific blocked
 * date (e.g. a single day of leave). Both are checked the same way
 * in `availability.service.js` — a date is unavailable for a doctor
 * if either a clinic-wide holiday or a doctor-specific block exists
 * for it.
 *
 * Stored as a normalized UTC midnight `Date` (see
 * `normalizeToDayStart` in the service layer) so a query for "is
 * 2026-08-20 blocked" is a simple equality/range match, not a
 * timezone-sensitive string comparison.
 */
export const blockedDateSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    reason: { type: String, trim: true, maxlength: 300, default: '' },

    // e.g. a national holiday that should be re-applied every year
    // without re-creating the document annually. Handled by the
    // service layer when checking a given date (matches month+day).
    isRecurringYearly: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

blockedDateSchema.index({ doctor: 1, date: 1 }, { unique: true });

export const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema, 'blocked_dates');
