import apiClient from './apiClient.js';

/**
 * FET-16 completion pass — admin side of the public "Contact" page
 * form (`server/src/modules/cms/routes/contact.routes.js`). The
 * public `POST /contact` submission itself has no admin-facing
 * wrapper here — that call is made directly from `client/website`,
 * a separate app from this dashboard. This file only covers the
 * inbox an admin/reception uses to review and triage what comes in:
 * `GET /cms/contact` (WEBSITE_MANAGE) and
 * `PATCH /cms/contact/:id` (status transitions NEW → READ → RESOLVED).
 */

export const listContactInquiries = async (params = {}) => {
  const { data } = await apiClient.get('/cms/contact', { params });
  return { items: data.data || [], pagination: data.meta?.pagination || null };
};

export const updateContactInquiryStatus = async (id, status) => {
  const { data } = await apiClient.patch(`/cms/contact/${id}`, { status });
  return data.data;
};
