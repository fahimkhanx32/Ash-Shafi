import * as contactService from '../services/contact.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

// Public — FET-16 "Contact" page form.
export const submitContactInquiryController = async (req, res, next) => {
  try {
    // Honeypot: a hidden `website` field on the public form that a
    // real user never sees or fills in. A populated value means a
    // bot filled every field it could find — respond with the same
    // 201 success shape (never reveal the honeypot exists) but skip
    // persistence entirely.
    if (req.body.website) {
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Thank you — your message has been received.',
        data: { id: null },
        requestId: req.requestId,
      });
    }

    const inquiry = await contactService.submitContactInquiry(req.body, req.ip);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.CMS_CONTACT_INQUIRY_SUBMIT,
      resourceType: 'ContactInquiry',
      resourceId: inquiry?._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Thank you — your message has been received.',
      data: { id: inquiry._id },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listContactInquiriesController = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await contactService.listContactInquiries({ status, page, limit });
    return sendPaginated(res, { ...result, requestId: req.requestId });
  } catch (error) {
    return next(error);
  }
};

export const updateContactInquiryStatusController = async (req, res, next) => {
  try {
    const inquiry = await contactService.markContactInquiryStatus(
      req.params.id,
      req.body.status,
      req.user,
    );

    await recordModification(req, {
      action: AUDIT_ACTIONS.CMS_CONTACT_INQUIRY_UPDATE,
      resourceType: 'ContactInquiry',
      resourceId: req.params.id,
    });

    return sendSuccess(res, {
      message: 'Inquiry status updated.',
      data: inquiry,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
