const USERS_KEY = 'janvani_demo_users';
const SESSION_KEY = 'janvani_demo_session';
const PBKDF2_ITERATIONS = 150000;

const publicUser = ({ id, name, email, phone, language }) => ({
  id,
  name,
  email,
  phone: phone || null,
  language: language || 'en',
  role: 'citizen',
});

const readUsers = () => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) return [];

  try {
    const users = JSON.parse(stored);
    if (!Array.isArray(users)) throw new Error('Expected local demo accounts to be a list.');
    return users;
  } catch {
    throw new Error('Local demo account data is invalid. Clear this site’s data to reset it.');
  }
};

const toBase64 = (bytes) => {
  let binary = '';
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const derivePasswordHash = async (password, salt) => {
  if (!crypto.subtle) {
    throw new Error('This browser does not support local demo authentication. Use a modern browser on localhost.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
};

export const getLocalSession = () => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored);
    if (!session?.id || !session?.email || session.role !== 'citizen') {
      throw new Error('Invalid local demo session.');
    }
    return publicUser(session);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    throw new Error('Local demo session is invalid. Please sign in again.');
  }
};

export const registerLocalUser = async ({ name, email, password, phone, language }) => {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Enter your name.');
  if (typeof email !== 'string' || !email.trim()) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Use a password with at least 8 characters.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('A local demo account with this email already exists. Sign in instead.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePasswordHash(password, salt);
  const account = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    phone: typeof phone === 'string' ? phone.trim() : '',
    language: language || 'en',
    passwordSalt: toBase64(salt),
    passwordHash: toBase64(passwordHash),
  };
  users.push(account);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const user = publicUser(account);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const loginLocalUser = async ({ email, password }) => {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new Error('Enter your email and password.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const account = readUsers().find((user) => user.email === normalizedEmail);
  if (!account) throw new Error('No local demo account found. Create an account first.');

  const candidateHash = await derivePasswordHash(password, fromBase64(account.passwordSalt));
  if (toBase64(candidateHash) !== account.passwordHash) {
    throw new Error('Incorrect email or password.');
  }

  const user = publicUser(account);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const logoutLocalUser = () => {
  localStorage.removeItem(SESSION_KEY);
};
