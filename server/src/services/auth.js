import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { User, LinkCode } from '../models/index.js';
import { AppError } from '../errors.js';
import { createUser } from './users.js';
import { ensureWallet } from './wallet/index.js';

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const COOKIE = 'settled_token';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const signToken = (config, userId) =>
  jwt.sign({ uid: String(userId) }, config.jwtSecret, { expiresIn: '30d' });
export function verifyToken(config, token) {
  try {
    return jwt.verify(token, config.jwtSecret).uid;
  } catch {
    return null;
  }
}

export async function afterCreate(config, user) {
  if (config.masterMnemonic) await ensureWallet(config, user._id);
  return user;
}

export async function signUp(config, { email, password, displayName }) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(e)) throw new AppError('BAD_REQUEST', 'Enter a valid email.');
  if (String(password || '').length < 8)
    throw new AppError('BAD_REQUEST', 'Password must be at least 8 characters.');
  if (await User.exists({ email: e }))
    throw new AppError('BAD_REQUEST', 'An account with this email exists. Sign in instead.');
  const user = await createUser(config, {
    email: e,
    passwordHash: await bcrypt.hash(password, 10),
    displayName: String(displayName || '').slice(0, 60),
  });
  return afterCreate(config, user);
}

export async function signIn({ email, password }) {
  const user = await User.findOne({
    email: String(email || '')
      .trim()
      .toLowerCase(),
  });
  if (
    !user ||
    !user.passwordHash ||
    !(await bcrypt.compare(String(password || ''), user.passwordHash))
  ) {
    throw new AppError('UNAUTHORIZED', 'Wrong email or password.');
  }
  return user;
}

export async function createLinkCode(userId, purpose) {
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  await LinkCode.create({
    userId,
    code,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return code;
}

// Single use, 10-minute expiry, purpose-bound.
export async function consumeLinkCode(code, purpose) {
  const lc = await LinkCode.findOneAndUpdate(
    {
      code: String(code || '')
        .trim()
        .toUpperCase(),
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!lc) throw new AppError('BAD_REQUEST', 'This code is wrong, used or expired.');
  return lc.userId;
}

export function publicUser(u) {
  return {
    id: String(u._id),
    email: u.email || null,
    displayName: u.displayName,
    claimFromName: u.claimFromName,
    telegramLinked: !!u.telegramId,
    leaderboardOptIn: u.leaderboardOptIn,
    caps: u.caps,
    isDemo: u.isDemo,
  };
}
