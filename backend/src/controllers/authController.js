import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../services/auditLog.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
    throw new Error('Set JWT_SECRET to a private random value of at least 32 characters.');
  }
  return secret;
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const createAccount = async (req, res, role) => {
  getJwtSecret();
  const { name, email, password, phone } = req.body || {};

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedName || normalizedName.length > 150 || !normalizedEmail || normalizedEmail.length > 255 || password.length < 8) {
    return res.status(400).json({ error: 'Enter a valid name and email, and use a password with at least 8 characters' });
  }

  const normalizedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
  if (normalizedPhone && normalizedPhone.length > 20) {
    return res.status(400).json({ error: 'Phone number must be at most 20 characters' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await withTransaction(async (transactionQuery) => {
      const result = await transactionQuery(
        `INSERT INTO users (full_name, email, password_hash, phone, role)
         VALUES (?, ?, ?, ?, ?)`,
        [normalizedName, normalizedEmail, passwordHash, normalizedPhone, role]
      );
      const userResult = await transactionQuery(
        `SELECT id, full_name AS name, email, phone, role, created_at, 'en' AS language
         FROM users WHERE id = ?`,
        [result.insertId]
      );
      await logAuditEvent(transactionQuery, {
        userId: result.insertId,
        action: role === 'admin' ? 'admin.registered' : 'user.registered',
        entityType: 'user',
        entityId: result.insertId,
      });
      return userResult.rows[0];
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or phone number already registered' });
    }
    throw error;
  }

  const token = generateToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    message: role === 'admin' ? 'Admin registration successful' : 'Registration successful',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      language: user.language,
    },
  });
};

const getAdminInviteStatus = (providedCode) => {
  const expectedCode = process.env.ADMIN_REGISTRATION_INVITE_CODE;
  if (!expectedCode || expectedCode.length < 32 || expectedCode.startsWith('replace-')) {
    return 'unconfigured';
  }
  if (typeof providedCode !== 'string') return 'invalid';

  const expectedBytes = Buffer.from(expectedCode, 'utf8');
  const providedBytes = Buffer.from(providedCode, 'utf8');
  if (expectedBytes.length !== providedBytes.length) return 'invalid';

  return timingSafeEqual(expectedBytes, providedBytes) ? 'valid' : 'invalid';
};

export const register = asyncHandler((req, res) => createAccount(req, res, 'citizen'));

export const registerAdmin = asyncHandler(async (req, res) => {
  const inviteStatus = getAdminInviteStatus(req.body?.invite_code);
  if (inviteStatus === 'unconfigured') {
    return res.status(503).json({ error: 'Admin registration is not configured on this server' });
  }
  if (inviteStatus !== 'valid') {
    return res.status(403).json({ error: 'A valid admin invitation code is required' });
  }

  await createAccount(req, res, 'admin');
});

export const login = asyncHandler(async (req, res) => {
  getJwtSecret();
  const { email, password, role } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await query(
    `SELECT id, full_name AS name, email, phone, password_hash, role, is_active, created_at,
            'en' AS language
     FROM users WHERE email = ? AND is_active = TRUE`,
    [email.trim().toLowerCase()]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ error: `This account is not authorized as ${role}` });
  }

  const token = generateToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: 'Login successful',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, language: user.language },
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, full_name AS name, email, phone, 'en' AS language, role, created_at
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: result.rows[0] });
});
