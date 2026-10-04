import mongoose from 'mongoose';

/**
 * BET-16 — Website media library (master prompt §39: "Media" content
 * type; §8 wallpaper-style upload validation principles reused here
 * for general website images).
 *
 * Deliberately a *separate* collection/Cloudinary folder from every
 * medical-file model (`MedicalReport`, message attachments, etc. —
 * master prompt §58: "Medical files must be separated logically from
 * public media"). Everything stored through this model is, by
 * design, public marketing content — never a patient file — so its
 * Cloudinary assets use plain public delivery (`type: 'upload'`),
 * unlike the `authenticated`-only delivery `report-storage.service.js`
 * uses for medical documents.
 */

const mediaSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, required: true, trim: true },
    cloudinaryPublicId: { type: String, required: true, trim: true, unique: true },
    cloudinaryResourceType: { type: String, trim: true, default: 'image' },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    altText: { type: String, trim: true, maxlength: 200, default: '' },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

mediaSchema.index({ createdAt: -1 });

export const Media = mongoose.model('Media', mediaSchema, 'website_media');
