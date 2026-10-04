import env from '../../config/env.js';
import { sendMail } from './mailer.js';

/**
 * Auth-related transactional emails (BET-03).
 *
 * Privacy-first by design (master prompt section 85): these emails
 * never include clinical/medical information, only generic
 * account-security notices and secure links.
 */

const buildLink = (path) => `${env.app.clientWebUrl.replace(/\/$/, '')}${path}`;

export const sendVerificationEmail = async (user, token) => {
  const link = buildLink(
    `/verify-email?token=${encodeURIComponent(token)}`,
  );

  return sendMail({
    to: user.email,
    subject: 'Verify your Ash-Shāfī account',
    text: `Hi ${user.name},\n\nPlease verify your account by visiting: ${link}\n\nThis link expires in ${env.verification.emailExpiresMinutes} minutes. If you did not create this account, you can safely ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Please verify your account by clicking the link below:</p><p><a href="${link}">Verify my account</a></p><p>This link expires in ${env.verification.emailExpiresMinutes} minutes. If you did not create this account, you can safely ignore this email.</p>`,
  });
};

export const sendPasswordResetEmail = async (user, token) => {
  const link = buildLink(
    `/reset-password?token=${encodeURIComponent(token)}`,
  );

  return sendMail({
    to: user.email,
    subject: 'Reset your Ash-Shāfī password',
    text: `Hi ${user.name},\n\nWe received a request to reset your password. Visit: ${link}\n\nThis link expires in ${env.verification.passwordResetExpiresMinutes} minutes. If you did not request this, you can safely ignore this email — your password will not change.`,
    html: `<p>Hi ${user.name},</p><p>We received a request to reset your password. Click the link below to choose a new one:</p><p><a href="${link}">Reset my password</a></p><p>This link expires in ${env.verification.passwordResetExpiresMinutes} minutes. If you did not request this, you can safely ignore this email — your password will not change.</p>`,
  });
};

export const sendPasswordChangedEmail = async (user) => {
  return sendMail({
    to: user.email,
    subject: 'Your password was changed',
    text: `Hi ${user.name},\n\nThis is a confirmation that your account password was just changed. If you did not make this change, please contact support immediately and secure your account.`,
    html: `<p>Hi ${user.name},</p><p>This is a confirmation that your account password was just changed. If you did not make this change, please contact support immediately and secure your account.</p>`,
  });
};

export const sendAccountLockedEmail = async (user) => {
  return sendMail({
    to: user.email,
    subject: 'Your account was temporarily locked',
    text: `Hi ${user.name},\n\nYour account was temporarily locked after several failed sign-in attempts. If this wasn't you, please reset your password once the lock expires.`,
    html: `<p>Hi ${user.name},</p><p>Your account was temporarily locked after several failed sign-in attempts. If this wasn't you, please reset your password once the lock expires.</p>`,
  });
};

/**
 * BET-05 — sent when an administrator provisions a staff/doctor/
 * admin account. Deliberately reuses the existing BET-03
 * `POST /auth/reset-password` flow (same token type, same endpoint)
 * instead of a separate "set initial password" mechanism — the
 * account has no usable password until this link is used, and no
 * password of any kind is ever emailed.
 */
export const sendWelcomeSetPasswordEmail = async (user, token) => {
  const link = buildLink(
    `/reset-password?token=${encodeURIComponent(token)}`,
  );

  return sendMail({
    to: user.email,
    subject: 'Welcome to Ash-Shāfī — set your password',
    text: `Hi ${user.name},\n\nAn account has been created for you on Ash-Shāfī. Set your password to activate it: ${link}\n\nThis link expires in ${env.verification.passwordResetExpiresMinutes} minutes. If you were not expecting this, please contact the clinic.`,
    html: `<p>Hi ${user.name},</p><p>An account has been created for you on Ash-Shāfī. Click below to set your password and activate it:</p><p><a href="${link}">Set my password</a></p><p>This link expires in ${env.verification.passwordResetExpiresMinutes} minutes. If you were not expecting this, please contact the clinic.</p>`,
  });
};

/**
 * BET-05 — sent when an administrator changes an account's status
 * (activate/deactivate/suspend). Deliberately generic, no clinical
 * content, consistent with the privacy-first-notifications principle
 * already applied to every other auth/account email here.
 */
export const sendAccountStatusChangedEmail = async (user, status) => {
  const statusMessage =
    status === 'ACTIVE'
      ? 'Your account has been reactivated and you can sign in again.'
      : `Your account access has been changed to "${status}" by an administrator. If you believe this is a mistake, please contact the clinic.`;

  return sendMail({
    to: user.email,
    subject: 'Your account status has changed',
    text: `Hi ${user.name},\n\n${statusMessage}`,
    html: `<p>Hi ${user.name},</p><p>${statusMessage}</p>`,
  });
};

/**
 * BET-17 Checkpoint 3 — account-deletion-request notices (master
 * prompt §38/§85). Deliberately generic, no clinical content. There
 * is no "approved" notice — by the time a request is approved, the
 * account's email address has already been anonymized (see
 * `modules/users/services/account-deletion.service.js`), so there is
 * no working address left to notify.
 */
export const sendAccountDeletionRequestReceivedEmail = async (user) =>
  sendMail({
    to: user.email,
    subject: 'Your account deletion request has been received',
    text: `Hi ${user.name},\n\nWe've received your request to delete your account. A staff member will review it, and your account will remain active until that review is complete. You can cancel this request at any time before it is processed.`,
    html: `<p>Hi ${user.name},</p><p>We've received your request to delete your account. A staff member will review it, and your account will remain active until that review is complete. You can cancel this request at any time before it is processed.</p>`,
  });

export const sendAccountDeletionRequestRejectedEmail = async (user) =>
  sendMail({
    to: user.email,
    subject: 'Your account deletion request was not approved',
    text: `Hi ${user.name},\n\nYour recent account deletion request was reviewed and was not approved. Your account remains active and unchanged. If you have questions, please contact the clinic.`,
    html: `<p>Hi ${user.name},</p><p>Your recent account deletion request was reviewed and was not approved. Your account remains active and unchanged. If you have questions, please contact the clinic.</p>`,
  });

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountLockedEmail,
  sendWelcomeSetPasswordEmail,
  sendAccountStatusChangedEmail,
  sendAccountDeletionRequestReceivedEmail,
  sendAccountDeletionRequestRejectedEmail,
};
