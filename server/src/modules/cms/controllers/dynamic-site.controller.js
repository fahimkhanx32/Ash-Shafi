import * as dynamicSiteService from '../services/dynamic-site.service.js';
import { sendSuccess } from '../../../utils/apiResponse.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { recordCreation, recordModification, recordDeletion } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// --- Navbar items ---

export const listPublicNavbarController = async (req, res, next) => {
  try {
    const items = await dynamicSiteService.listPublicNavbarItems();
    return sendSuccess(res, { data: items, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAllNavbarController = async (req, res, next) => {
  try {
    const items = await dynamicSiteService.listAllNavbarItems();
    return sendSuccess(res, { data: items, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createNavbarItemController = async (req, res, next) => {
  try {
    const item = await dynamicSiteService.createNavbarItem(req.body, req.user);
    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_NAVBAR_ITEM_CREATE,
      resourceType: 'NavbarItem',
      resourceId: item?._id,
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Navbar item created successfully.',
      data: item,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateNavbarItemController = async (req, res, next) => {
  try {
    const item = await dynamicSiteService.updateNavbarItem(req.params.id, req.body, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_NAVBAR_ITEM_UPDATE,
      resourceType: 'NavbarItem',
      resourceId: req.params.id,
    });
    return sendSuccess(res, { message: 'Navbar item updated successfully.', data: item, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const reorderNavbarController = async (req, res, next) => {
  try {
    const items = await dynamicSiteService.reorderNavbarItems(req.body.orderedIds, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_NAVBAR_REORDER,
      resourceType: 'NavbarItem',
      resourceId: null,
    });
    return sendSuccess(res, { message: 'Navbar reordered successfully.', data: items, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const deleteNavbarItemController = async (req, res, next) => {
  try {
    await dynamicSiteService.deleteNavbarItem(req.params.id);
    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_NAVBAR_ITEM_DELETE,
      resourceType: 'NavbarItem',
      resourceId: req.params.id,
    });
    return sendSuccess(res, { message: 'Navbar item deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

// --- Certificates ---

export const listPublicCertificatesController = async (req, res, next) => {
  try {
    const certificates = await dynamicSiteService.listActiveCertificates();
    return sendSuccess(res, { data: certificates, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAllCertificatesController = async (req, res, next) => {
  try {
    const certificates = await dynamicSiteService.listAllCertificates();
    return sendSuccess(res, { data: certificates, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createCertificateController = async (req, res, next) => {
  try {
    const certificate = await dynamicSiteService.createCertificate(req.body, req.user);
    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_CERTIFICATE_CREATE,
      resourceType: 'Certificate',
      resourceId: certificate?._id,
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Certificate created successfully.',
      data: certificate,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCertificateController = async (req, res, next) => {
  try {
    const certificate = await dynamicSiteService.updateCertificate(req.params.id, req.body, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_CERTIFICATE_UPDATE,
      resourceType: 'Certificate',
      resourceId: req.params.id,
    });
    return sendSuccess(res, {
      message: 'Certificate updated successfully.',
      data: certificate,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const reorderCertificatesController = async (req, res, next) => {
  try {
    const certificates = await dynamicSiteService.reorderCertificates(req.body.orderedIds, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_CERTIFICATE_REORDER,
      resourceType: 'Certificate',
      resourceId: null,
    });
    return sendSuccess(res, {
      message: 'Certificates reordered successfully.',
      data: certificates,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCertificateController = async (req, res, next) => {
  try {
    await dynamicSiteService.deleteCertificate(req.params.id);
    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_CERTIFICATE_DELETE,
      resourceType: 'Certificate',
      resourceId: req.params.id,
    });
    return sendSuccess(res, { message: 'Certificate deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

// --- Hero banner ---

export const getHeroBannerController = async (req, res, next) => {
  try {
    const banner = await dynamicSiteService.getHeroBanner();
    return sendSuccess(res, { data: banner, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const upsertHeroBannerController = async (req, res, next) => {
  try {
    const banner = await dynamicSiteService.upsertHeroBanner(req.body, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_HERO_BANNER_UPDATE,
      resourceType: 'HeroBanner',
      resourceId: banner?._id,
    });
    return sendSuccess(res, { message: 'Hero banner updated successfully.', data: banner, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const uploadHeroBannerMediaController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
    }
    const banner = await dynamicSiteService.uploadHeroBannerMedia(req.file, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_HERO_BANNER_MEDIA_UPLOAD,
      resourceType: 'HeroBanner',
      resourceId: banner?._id,
    });
    return sendSuccess(res, {
      message: 'Hero banner background uploaded successfully.',
      data: banner,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// --- Homepage sections ---

export const listPublicSectionsController = async (req, res, next) => {
  try {
    const sections = await dynamicSiteService.listPublicSections();
    return sendSuccess(res, { data: sections, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const listAllSectionsController = async (req, res, next) => {
  try {
    const sections = await dynamicSiteService.listAllSections();
    return sendSuccess(res, { data: sections, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const createSectionController = async (req, res, next) => {
  try {
    const section = await dynamicSiteService.createCustomSection(req.body, req.user);
    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_SECTION_CREATE,
      resourceType: 'HomepageSection',
      resourceId: section?._id,
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Section created successfully.',
      data: section,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSectionController = async (req, res, next) => {
  try {
    const section = await dynamicSiteService.updateSection(req.params.id, req.body, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_SECTION_UPDATE,
      resourceType: 'HomepageSection',
      resourceId: req.params.id,
    });
    return sendSuccess(res, { message: 'Section updated successfully.', data: section, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const reorderSectionsController = async (req, res, next) => {
  try {
    const sections = await dynamicSiteService.reorderSections(req.body.orderedIds, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_SECTION_REORDER,
      resourceType: 'HomepageSection',
      resourceId: null,
    });
    return sendSuccess(res, { message: 'Sections reordered successfully.', data: sections, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const deleteSectionController = async (req, res, next) => {
  try {
    await dynamicSiteService.deleteSection(req.params.id);
    await recordDeletion(req, {
      action: AUDIT_ACTIONS.CMS_SECTION_DELETE,
      resourceType: 'HomepageSection',
      resourceId: req.params.id,
    });
    return sendSuccess(res, { message: 'Section deleted successfully.', requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const uploadSectionMediaController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file was uploaded.', 400, { code: 'FILE_REQUIRED' });
    }
    const section = await dynamicSiteService.uploadSectionBackgroundMedia(req.params.id, req.file, req.user);
    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_SECTION_MEDIA_UPLOAD,
      resourceType: 'HomepageSection',
      resourceId: section?._id,
    });
    return sendSuccess(res, {
      message: 'Section background uploaded successfully.',
      data: section,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
