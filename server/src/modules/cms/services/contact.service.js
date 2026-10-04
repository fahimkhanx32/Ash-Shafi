import mongoose from 'mongoose';

import { ContactInquiry } from '../models/contact-inquiry.model.js';
import { sanitizeHtmlContent } from '../../../security/sanitization.js';
import { AppError } from '../../../middlewares/error.middleware.js';

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Public — no `actor`, this is an anonymous marketing-site form
// submission. `message` is run through the same sanitizer every other
// user-authored CMS text field uses before persistence; every other
// field is plain text bounded by the schema's own `maxlength`.
export const submitContactInquiry = async (data, ipAddress) => {
  const inquiry = await ContactInquiry.create({
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    subject: data.subject || '',
    message: sanitizeHtmlContent(data.message),
    ipAddress: ipAddress || '',
  });
  return inquiry;
};

export const listContactInquiries = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    ContactInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    ContactInquiry.countDocuments(filter),
  ]);

  return { items, total, page: safePage, limit: safeLimit };
};

export const markContactInquiryStatus = async (id, status, actor) => {
  if (!isValidObjectId(id)) {
    throw new AppError('Invalid inquiry id.', 400, { code: 'INVALID_ID' });
  }
  const inquiry = await ContactInquiry.findById(id);
  if (!inquiry) {
    throw new AppError('Contact inquiry not found.', 404, { code: 'INQUIRY_NOT_FOUND' });
  }
  inquiry.status = status;
  inquiry.reviewedBy = actor._id;
  inquiry.reviewedAt = new Date();
  await inquiry.save();
  return inquiry;
};
