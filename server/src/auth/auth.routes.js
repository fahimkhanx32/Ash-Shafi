import express from 'express';

import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  logoutAllController,
  listSessionsController,
  revokeSessionController,
  verifyEmailController,
  resendVerificationController,
  changePasswordController,
  forgotPasswordController,
  resetPasswordController,
  meController,
  updatePreferencesController,
  updateUsernameController,
  updateEmailController,
  updateProfileImageController,
} from './auth.controller.js';

import {
  requestMyAccountDeletionController,
  cancelMyAccountDeletionController,
} from '../modules/users/controllers/account-deletion.controller.js';

import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  revokeSessionParamsSchema,
  updatePreferencesSchema,
  updateUsernameSchema,
  updateEmailSchema,
  updateProfileImageSchema,
} from './auth.validation.js';

import {
  requestAccountDeletionSchema,
  cancelAccountDeletionSchema,
} from '../modules/users/validators/account-deletion.validation.js';

import { validateBody, validateParams } from '../middlewares/validation.middleware.js';

import { authenticate } from '../middlewares/auth.middleware.js';

import {
  authRateLimiter,
  passwordResetRateLimiter,
} from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

// ------------------------------------------------------------------
// Public
// ------------------------------------------------------------------

router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  registerController,
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  loginController,
);

router.post(
  '/refresh',
  authRateLimiter,
  validateBody(refreshSchema),
  refreshController,
);

router.post(
  '/logout',
  validateBody(logoutSchema),
  logoutController,
);

router.post(
  '/verify-email',
  authRateLimiter,
  validateBody(verifyEmailSchema),
  verifyEmailController,
);

router.post(
  '/resend-verification',
  authRateLimiter,
  validateBody(resendVerificationSchema),
  resendVerificationController,
);

router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPasswordController,
);

router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validateBody(resetPasswordSchema),
  resetPasswordController,
);

// ------------------------------------------------------------------
// Authenticated
// ------------------------------------------------------------------

router.get('/me', authenticate, meController);

router.patch(
  '/me/preferences',
  authenticate,
  validateBody(updatePreferencesSchema),
  updatePreferencesController,
);

router.patch(
  '/me/username',
  authenticate,
  validateBody(updateUsernameSchema),
  updateUsernameController,
);

router.patch(
  '/me/email',
  authenticate,
  validateBody(updateEmailSchema),
  updateEmailController,
);

router.patch(
  '/me/profile-image',
  authenticate,
  validateBody(updateProfileImageSchema),
  updateProfileImageController,
);

router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  changePasswordController,
);

router.post('/logout-all', authenticate, logoutAllController);

router.get('/sessions', authenticate, listSessionsController);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  validateParams(revokeSessionParamsSchema),
  revokeSessionController,
);

// BET-17 checkpoint 3 — self-service account deletion request
// (master prompt §38). Deliberately lives under `/auth/me/...`
// rather than `/users/...` — this is the account holder acting on
// their own account, the same shape as `/change-password` and
// `/logout-all` above, not administrative user management.
router.post(
  '/me/deletion-request',
  authenticate,
  validateBody(requestAccountDeletionSchema),
  requestMyAccountDeletionController,
);

router.delete(
  '/me/deletion-request',
  authenticate,
  validateBody(cancelAccountDeletionSchema),
  cancelMyAccountDeletionController,
);

export default router;
