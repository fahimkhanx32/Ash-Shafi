import apiClient from './apiClient.js';

/**
 * Thin wrapper around `server/src/modules/cms`'s dynamic-site routes
 * (FET-16): navbar items, homepage hero/banner, certificates, and the
 * homepage section layout registry. Reads are public on the backend,
 * but every write here requires `WEBSITE_MANAGE`
 * (`ADMIN_TIER_ROLES` on the frontend — see navConfig.js).
 *
 * Response bodies already come back with a Mongoose `_id`; unlike
 * departmentsService.js's `withId` shim (needed there because that
 * list endpoint runs `.lean()`), these endpoints return full Mongoose
 * documents whose `id` virtual is present, so no normalization is
 * needed here.
 */

// --- Navbar items ---

export const listPublicNavbarItems = async () => {
  const { data } = await apiClient.get('/cms/navbar');
  return data.data || [];
};

export const listAllNavbarItems = async () => {
  const { data } = await apiClient.get('/cms/navbar/all');
  return data.data || [];
};

export const createNavbarItem = async (payload) => {
  const { data } = await apiClient.post('/cms/navbar', payload);
  return data.data;
};

export const updateNavbarItem = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/navbar/${id}`, payload);
  return data.data;
};

export const reorderNavbarItems = async (orderedIds) => {
  const { data } = await apiClient.patch('/cms/navbar/reorder', { orderedIds });
  return data.data;
};

export const deleteNavbarItem = async (id) => {
  await apiClient.delete(`/cms/navbar/${id}`);
};

// --- Certificates ---

export const listAllCertificates = async () => {
  const { data } = await apiClient.get('/cms/certificates/all');
  return data.data || [];
};

export const createCertificate = async (payload) => {
  const { data } = await apiClient.post('/cms/certificates', payload);
  return data.data;
};

export const updateCertificate = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/certificates/${id}`, payload);
  return data.data;
};

export const reorderCertificates = async (orderedIds) => {
  const { data } = await apiClient.patch('/cms/certificates/reorder', { orderedIds });
  return data.data;
};

export const deleteCertificate = async (id) => {
  await apiClient.delete(`/cms/certificates/${id}`);
};

// Uploads a certificate logo directly to the shared media library
// (`POST /cms/media`) and returns the URL/publicId to attach to the
// certificate's `image` field — a certificate's own record only
// stores a reference, not the file itself.
export const uploadCertificateImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/cms/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { url: data.data.url, cloudinaryPublicId: data.data.cloudinaryPublicId };
};

// --- Hero banner (singleton) ---

export const getHeroBanner = async () => {
  const { data } = await apiClient.get('/cms/hero-banner');
  return data.data;
};

export const upsertHeroBanner = async (payload) => {
  const { data } = await apiClient.put('/cms/hero-banner', payload);
  return data.data;
};

// Accepts an image OR a video file — the backend's `uploadBannerMedia`
// middleware and `uploadHeroBannerMedia` service branch on mimetype.
export const uploadHeroBannerMedia = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/cms/hero-banner/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return data.data;
};

// --- Homepage sections (layout registry) ---

export const listAllSections = async () => {
  const { data } = await apiClient.get('/cms/sections/all');
  return data.data || [];
};

export const createSection = async (payload) => {
  const { data } = await apiClient.post('/cms/sections', payload);
  return data.data;
};

export const updateSection = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/sections/${id}`, payload);
  return data.data;
};

export const reorderSections = async (orderedIds) => {
  const { data } = await apiClient.patch('/cms/sections/reorder', { orderedIds });
  return data.data;
};

export const deleteSection = async (id) => {
  await apiClient.delete(`/cms/sections/${id}`);
};

export const uploadSectionMedia = async (id, file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post(`/cms/sections/${id}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return data.data;
};

// --- Services (existing cms.routes.js endpoints — no admin UI existed
// for these yet either; wired up here alongside the new modules) ---

export const listAllServices = async () => {
  const { data } = await apiClient.get('/cms/services/all');
  return data.data || [];
};

export const createService = async (payload) => {
  const { data } = await apiClient.post('/cms/services', payload);
  return data.data;
};

export const updateService = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/services/${id}`, payload);
  return data.data;
};

export const deleteService = async (id) => {
  await apiClient.delete(`/cms/services/${id}`);
};

// --- Homepage stats ("15+ Years of Excellence", etc.) ---

export const listAllStats = async () => {
  const { data } = await apiClient.get('/cms/stats/all');
  return data.data || [];
};

export const createStat = async (payload) => {
  const { data } = await apiClient.post('/cms/stats', payload);
  return data.data;
};

export const updateStat = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/stats/${id}`, payload);
  return data.data;
};

export const deleteStat = async (id) => {
  await apiClient.delete(`/cms/stats/${id}`);
};

// --- About content (singleton) ---

export const getAboutContent = async () => {
  const { data } = await apiClient.get('/cms/about');
  return data.data;
};

export const upsertAboutContent = async (payload) => {
  const { data } = await apiClient.put('/cms/about', payload);
  return data.data;
};

// --- Pages (Home/About/Doctor/Services/Appointment/Schedule/Location/
// FAQ/Blog/Contact/Privacy/Terms/Custom) ---

export const listPages = async (params = {}) => {
  const { data } = await apiClient.get('/cms/pages', { params });
  return { items: data.data || [], pagination: data.meta?.pagination || null };
};

export const getPage = async (id) => {
  const { data } = await apiClient.get(`/cms/pages/${id}`);
  return data.data;
};

export const createPage = async (payload) => {
  const { data } = await apiClient.post('/cms/pages', payload);
  return data.data;
};

export const updatePage = async (id, payload) => {
  const { data } = await apiClient.patch(`/cms/pages/${id}`, payload);
  return data.data;
};

export const deletePage = async (id) => {
  await apiClient.delete(`/cms/pages/${id}`);
};

export const publishPage = async (id) => {
  const { data } = await apiClient.post(`/cms/pages/${id}/publish`);
  return data.data;
};

export const unpublishPage = async (id) => {
  const { data } = await apiClient.post(`/cms/pages/${id}/unpublish`);
  return data.data;
};

export const archivePage = async (id) => {
  const { data } = await apiClient.post(`/cms/pages/${id}/archive`);
  return data.data;
};

// --- Media library ---

export const listMedia = async (params = {}) => {
  const { data } = await apiClient.get('/cms/media', { params });
  return { items: data.data || [], pagination: data.meta?.pagination || null };
};

export const uploadMedia = async (file, altText = '', onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  if (altText) formData.append('altText', altText);
  const { data } = await apiClient.post('/cms/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
  return data.data;
};

export const deleteMedia = async (id) => {
  await apiClient.delete(`/cms/media/${id}`);
};
