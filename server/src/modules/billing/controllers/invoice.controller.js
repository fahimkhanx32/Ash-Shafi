import * as invoiceService from '../services/invoice.service.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import { recordCreation, recordModification } from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const createInvoiceController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user);

    await recordCreation(req, {
      action: AUDIT_ACTIONS.INVOICE_CREATE,
      resourceType: 'Invoice',
      resourceId: invoice?._id,
      patientId: invoice?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Invoice created successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const applyDiscountController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.applyDiscount(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVOICE_DISCOUNT_APPLIED,
      resourceType: 'Invoice',
      resourceId: req.params.id,
      patientId: invoice?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Discount applied successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const addInvoiceItemController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.addInvoiceItem(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVOICE_ITEM_ADDED,
      resourceType: 'Invoice',
      resourceId: req.params.id,
      patientId: invoice?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Invoice item added successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeInvoiceItemController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.removeInvoiceItem(req.params.id, { itemId: req.params.itemId }, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVOICE_ITEM_REMOVED,
      resourceType: 'Invoice',
      resourceId: req.params.id,
      patientId: invoice?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Invoice item removed successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelInvoiceController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancelInvoice(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.INVOICE_CANCEL,
      resourceType: 'Invoice',
      resourceId: req.params.id,
      patientId: invoice?.patientProfile ?? null,
      reason: req.body?.reason ?? null,
    });

    return sendSuccess(res, {
      message: 'Invoice cancelled successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getInvoiceController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user);

    return sendSuccess(res, {
      message: 'Invoice retrieved successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyInvoiceController = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user);

    return sendSuccess(res, {
      message: 'Invoice retrieved successfully.',
      data: invoice,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listInvoicesController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await invoiceService.listInvoices(req.query, req.user);

    return sendPaginated(res, {
      message: 'Invoices retrieved successfully.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyInvoicesController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await invoiceService.getMyInvoices(req.user, req.query);

    return sendPaginated(res, {
      message: 'Invoices retrieved successfully.',
      items,
      page,
      limit,
      total,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
