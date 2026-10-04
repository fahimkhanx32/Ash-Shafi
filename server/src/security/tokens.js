import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import env from '../config/env.js';

const baseJwtOptions = {
  issuer: env.jwt.issuer,
  audience: env.jwt.audience,
};

export const createAccessToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      tokenType: 'access',
    },
    env.jwt.accessSecret,
    {
      ...baseJwtOptions,
      expiresIn: env.jwt.accessExpiresIn,
    },
  );
};

export const createRefreshToken = (payload) => {
  const tokenId = crypto.randomUUID();

  const token = jwt.sign(
    {
      ...payload,
      tokenType: 'refresh',
      tokenId,
    },
    env.jwt.refreshSecret,
    {
      ...baseJwtOptions,
      expiresIn: env.jwt.refreshExpiresIn,
    },
  );

  return {
    token,
    tokenId,
  };
};

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, env.jwt.accessSecret, {
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });

  if (
    typeof payload !== 'object' ||
    payload === null ||
    payload.tokenType !== 'access'
  ) {
    throw new Error('Invalid access token.');
  }

  return payload;
};

export const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, env.jwt.refreshSecret, {
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });

  if (
    typeof payload !== 'object' ||
    payload === null ||
    payload.tokenType !== 'refresh'
  ) {
    throw new Error('Invalid refresh token.');
  }

  return payload;
};

export const generateOpaqueToken = (bytes = 32) => {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new TypeError('Token size must be at least 16 bytes.');
  }

  return crypto.randomBytes(bytes).toString('hex');
};

export const hashToken = (token) => {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('Token must be a non-empty string.');
  }

  return crypto
    .createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
};