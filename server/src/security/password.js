import argon2 from 'argon2';

import env from '../config/env.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: env.password.memoryCost,
  timeCost: env.password.timeCost,
  parallelism: env.password.parallelism,
};

export const hashPassword = async (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string.');
  }

  return argon2.hash(password, ARGON2_OPTIONS);
};

export const verifyPassword = async (hash, password) => {
  if (
    typeof hash !== 'string' ||
    typeof password !== 'string' ||
    !hash ||
    !password
  ) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

export const needsPasswordRehash = async (hash) => {
  if (typeof hash !== 'string' || !hash) {
    return true;
  }

  try {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
};