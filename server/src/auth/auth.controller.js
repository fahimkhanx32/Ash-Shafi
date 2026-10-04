import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  verifyEmail,
  resendVerificationEmail,
  changePassword,
  requestPasswordReset,
  resetPassword,
  updateUserPreferences,
  updateUsername,
  updateEmail,
  updateProfileImage,
} from './auth.service.js';

import { hashToken } from '../security/tokens.js';

const requestMeta = (req) => ({
  ipAddress: req.ip || null,
  userAgent: req.get('user-agent') || null,
});

export const registerController = async (req, res, next) => {
  try {
    const { name, username, email, phone, password } = req.body;

    const result = await register({
      name,
      username,
      email,
      phone,
      password,
      ...requestMeta(req),
    });

    return res.status(201).json({
      success: true,
      message: result.user.email
        ? 'Account created. Please check your email to verify your account.'
        : 'Account created. You can sign in now.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const loginController = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    const result = await login({
      identifier,
      password,
      ...requestMeta(req),
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const refreshController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const result = await refresh({
      refreshToken,
      ...requestMeta(req),
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    await logout({ refreshToken });

    return res.status(200).json({
      success: true,
      message: 'Logout successful.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const logoutAllController = async (req, res, next) => {
  try {
    await logoutAll({ userId: req.user._id });

    return res.status(200).json({
      success: true,
      message: 'Logged out from all devices.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const listSessionsController = async (req, res, next) => {
  try {
    // Sessions are tracked by refresh-token id, not access-token id,
    // so "current" cannot be derived from the access token alone.
    // FET-04: the web client decodes the (unverified) tokenId claim
    // out of its own refresh token — which it already holds — and
    // sends only that opaque id via X-Current-Token-Id. Nothing
    // secret is exposed by this: the tokenId is meaningless without
    // the signed token itself, and it never leaves the request as
    // anything but its SHA-256 hash for comparison against the
    // stored `tokenIdHash`.
    const currentTokenId = req.get('x-current-token-id');

    const sessions = await listSessions({
      userId: req.user._id,
      currentTokenIdHash:
        typeof currentTokenId === 'string' && currentTokenId.trim()
          ? hashToken(currentTokenId.trim())
          : null,
    });

    return res.status(200).json({
      success: true,
      message: 'Active sessions retrieved successfully.',
      data: { sessions },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const revokeSessionController = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await revokeSession({ userId: req.user._id, sessionId });

    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyEmailController = async (req, res, next) => {
  try {
    const { token } = req.body;

    const result = await verifyEmail({ token });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const resendVerificationController = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    await resendVerificationEmail({ identifier });

    return res.status(200).json({
      success: true,
      message:
        'If an account matching that email exists and is not yet verified, a verification email has been sent.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const changePasswordController = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    await changePassword({
      userId: req.user._id,
      currentPassword,
      newPassword,
    });

    return res.status(200).json({
      success: true,
      message:
        'Password changed successfully. For your security, you have been signed out everywhere — please sign in again with your new password.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const forgotPasswordController = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    await requestPasswordReset({ identifier, ...requestMeta(req) });

    return res.status(200).json({
      success: true,
      message:
        'If an account matching that information exists, a password reset email has been sent.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPasswordController = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    await resetPassword({ token, newPassword, ...requestMeta(req) });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please sign in again.',
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const meController = async (req, res, next) => {
  try {
    const user = req.user;

    return res.status(200).json({
      success: true,
      message: 'Authenticated user retrieved successfully.',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          isProtected: Boolean(user.isProtected),
          emailVerifiedAt: user.emailVerifiedAt,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          uiPreferences: user.uiPreferences,
        },
      },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updatePreferencesController = async (req, res, next) => {
  try {
    const user = await updateUserPreferences(req.user._id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully.',
      data: { user },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUsernameController = async (req, res, next) => {
  try {
    const user = await updateUsername(req.user._id, req.body.username);
    return res.status(200).json({
      success: true,
      message: 'Username updated successfully.',
      data: { user },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateEmailController = async (req, res, next) => {
  try {
    const user = await updateEmail(req.user._id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Email updated. Please verify your new address.',
      data: { user },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfileImageController = async (req, res, next) => {
  try {
    const user = await updateProfileImage(req.user._id, req.body.profileImage);
    return res.status(200).json({
      success: true,
      message: req.body.profileImage ? 'Profile picture updated.' : 'Profile picture removed.',
      data: { user },
      requestId: req.requestId,
    });
  } catch (error) {
    return next(error);
  }
};
