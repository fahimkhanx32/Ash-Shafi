/**
 * BET-15.2 — The "manual" provider covers `CASH` and `BANK_TRANSFER`
 * payments a staff member physically reconciles and records
 * themselves. It has no `createCheckout`/webhook/refund API to call —
 * the staff member's own authenticated, permission-checked, audited
 * action (`payment.service.js`'s `recordManualPayment`) *is* the
 * verification, exactly the way `master prompt §36` describes
 * "administrator-triggered" flows elsewhere in this system. Always
 * reports itself configured — there is no external credential to be
 * missing.
 *
 * @type {import('./payment-provider.interface.js').PaymentProvider}
 */
export const manualPaymentProvider = {
  name: 'manual',
  isConfigured: () => true,
};
