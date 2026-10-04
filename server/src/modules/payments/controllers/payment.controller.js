import * as paymentService from '../services/payment.service.js';
import { generateReceiptPdf } from '../services/receipt-pdf.service.js';
import { hasPermission } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { sendSuccess, sendPaginated } from '../../../utils/apiResponse.js';
import {
  recordModification,
  recordExport,
  recordFileAccess,
} from '../../../audit/audit.service.js';
import { AUDIT_ACTIONS } from '../../../audit/audit.constants.js';

export const initiatePaymentController = async (req, res, next) => {
  try {
    const { invoiceId, method, idempotencyKey } = req.body;

    const { payment, checkout } = await paymentService.initiateOnlinePayment(
      invoiceId,
      { method, idempotencyKey },
      req.user,
      hasPermission,
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Payment initiated successfully.',
      data: { payment, checkout },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const recordManualPaymentController = async (req, res, next) => {
  try {
    const { invoiceId, ...rest } = req.body;
    const payment = await paymentService.recordManualPayment(invoiceId, rest, req.user);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Payment recorded successfully.',
      data: payment,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

// Public — no `authenticate` (the gateway itself calls this, not a
// logged-in user). Trust boundary is entirely the HMAC signature
// check inside `handleWebhook`, verified against `req.rawBody`.
export const webhookController = async (req, res, next) => {
  try {
    await paymentService.handleWebhook(req.rawBody, req.headers);

    // Always 200 once signature-verified and processed (or safely
    // ignored for an unknown transaction) so the provider stops
    // retrying — this is the standard webhook-ack contract.
    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentController = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.user);

    return sendSuccess(res, {
      message: 'Payment retrieved successfully.',
      data: payment,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listPaymentsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await paymentService.listPayments(req.query);

    return sendPaginated(res, {
      message: 'Payments retrieved successfully.',
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

export const getMyPaymentsController = async (req, res, next) => {
  try {
    const { items, page, limit, total } = await paymentService.getMyPayments(req.user, req.query);

    return sendPaginated(res, {
      message: 'Payments retrieved successfully.',
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

export const refundPaymentController = async (req, res, next) => {
  try {
    const refund = await paymentService.refundPayment(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PAYMENT_REFUND,
      resourceType: 'Payment',
      resourceId: req.params.id,
      patientId: refund?.patientProfile ?? null,
      reason: req.body?.reason ?? null,
      metadata: { amount: req.body?.amount ?? null },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Refund processed.',
      data: refund,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * BET-15 — cancels an abandoned `PENDING` online-checkout payment.
 * Uses the same `assertCanAccessAsSelf`-backed ownership check inside
 * `paymentService.cancelPendingPayment` as every other single-payment
 * route, so a `PATIENT` may only ever cancel their own pending
 * payment.
 */
export const cancelPaymentController = async (req, res, next) => {
  try {
    const payment = await paymentService.cancelPendingPayment(req.params.id, req.body, req.user);

    await recordModification(req, {
      action: AUDIT_ACTIONS.PAYMENT_CANCEL,
      resourceType: 'Payment',
      resourceId: req.params.id,
      patientId: payment?.patientProfile ?? null,
    });

    return sendSuccess(res, {
      message: 'Payment cancelled.',
      data: payment,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listRefundsController = async (req, res, next) => {
  try {
    const refunds = await paymentService.getRefundsForPayment(req.params.id);

    return sendSuccess(res, {
      message: 'Refunds retrieved successfully.',
      data: refunds,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * BET-15.1 ("Receipts"). Deliberately calls the exact same
 * `getPaymentById(id, actor)` ownership/permission check the JSON
 * detail endpoint uses (mirrors `getPrescriptionPdfController`'s
 * pattern from BET-11) — the receipt route is not a second, weaker
 * way to reach a payment's data. Only a payment that has actually
 * succeeded (at least once — refunds are noted on the receipt, not a
 * reason to hide it) has anything to receipt.
 */
export const getPaymentReceiptController = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.user);

    if (!['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status)) {
      throw new AppError('A receipt is only available for a payment that has succeeded.', 409, {
        code: 'PAYMENT_NOT_SUCCEEDED',
      });
    }

    const populated = await payment.populate([
      { path: 'invoice', select: 'invoiceNumber grandTotal balanceDue' },
      { path: 'patientProfile', select: 'patientId firstName lastName' },
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${populated._id}.pdf"`);

    await recordFileAccess(req, {
      action: AUDIT_ACTIONS.PAYMENT_RECEIPT_DOWNLOAD,
      resourceType: 'Payment',
      resourceId: populated?._id ?? req.params.id,
      patientId: populated?.patientProfile?._id ?? populated?.patientProfile ?? null,
    });
    await recordExport(req, {
      action: AUDIT_ACTIONS.PAYMENT_RECEIPT_DOWNLOAD,
      resourceType: 'Payment',
      resourceId: populated?._id ?? req.params.id,
      patientId: populated?.patientProfile?._id ?? populated?.patientProfile ?? null,
    });

    await generateReceiptPdf(populated, res);
  } catch (error) {
    return next(error);
  }
};
