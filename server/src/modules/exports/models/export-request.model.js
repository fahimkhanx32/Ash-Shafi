import mongoose from 'mongoose';

/**
 * BET-19 checkpoint 2 — "Controlled export".
 *
 * A sensitive export (currently: the medical-record package) is
 * never streamed directly back to the requesting HTTP response the
 * way the checkpoint-1 bulk CSV/XLSX/PDF/JSON exports are. Instead,
 * the request step generates the file, stores it here behind an
 * opaque, single-use, time-limited download token, and returns only
 * the token — the actual bytes are fetched through a second,
 * separate `GET /exports/download/:token` call. This mirrors the
 * exact "generate a short-lived signed download, never a permanent
 * direct link" shape `report-storage.service.js`'s Cloudinary
 * `private_download_url` already established for report files
 * (BET-12), and the "hash the token, never store it in plaintext"
 * discipline `auth/session.model.js`/`User.passwordResetTokenHash`
 * already use for every other bearer-token-style credential in this
 * project.
 *
 * The file itself (`fileBuffer`) is stored inline in MongoDB rather
 * than on disk/Cloudinary — deliberate for now, since generated
 * export packages are small (a handful of MB at most; `fileBuffer`
 * has no schema-level cap here, but callers should keep this in mind
 * — see `medical-record-export.service.js`) and this project has no
 * general-purpose private object storage for *generated* files
 * (Cloudinary, per `config/cloudinary.js`, is used for user-uploaded
 * documents/media, not server-generated exports). Revisit if export
 * packages grow large enough to matter.
 *
 * The MongoDB TTL index below (`expireAfterSeconds: 0` on
 * `expiresAt`) auto-deletes the document — and its embedded file
 * buffer — once expired, so an unclaimed controlled export never
 * lingers in the database. This is the actual "time-limited" half of
 * §52's "permission controlled / audited / protected / time-limited"
 * requirement for every sensitive export.
 */

const exportRequestSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which patient this controlled export is scoped to — kept even
    // though it's also implicit in the file content, so
    // `consumeControlledExport` can be extended later to re-verify
    // the downloader still holds access to this specific patient at
    // download time, not only at request time.
    patientProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: true,
      index: true,
    },

    exportType: {
      type: String,
      required: true,
      enum: ['MEDICAL_RECORD_PACKAGE'],
      default: 'MEDICAL_RECORD_PACKAGE',
    },

    format: {
      type: String,
      required: true,
      enum: ['PDF', 'JSON'],
    },

    filename: {
      type: String,
      required: true,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      required: true,
      maxlength: 255,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },

    fileBuffer: {
      type: Buffer,
      required: true,
    },

    // A controlled export is single-use — once downloaded, the
    // token is consumed and every subsequent attempt with the same
    // token fails, the same "a link works once" contract a
    // password-reset link already follows elsewhere in this project.
    consumedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

exportRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ExportRequest = mongoose.model(
  'ExportRequest',
  exportRequestSchema,
  'export_requests',
);
