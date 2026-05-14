import axios from 'axios';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function saveSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getSavedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const authService = {
  getSavedUser,
  clearSession,
  saveSession,

  loginAdmin: async (username, password) => {
    const res = await axios.post('/api/auth/login', {
      identifier: username,
      password,
      roleHint: 'admin',
    });
    return res.data;
  },

  loginEmployee: async (email, password) => {
    const res = await axios.post('/api/auth/login', {
      identifier: email,
      password,
      roleHint: 'employee',
    });
    return res.data;
  },

  register: async (userData) => {
    const res = await axios.post('/api/auth/register', userData);
    return res.data;
  },

  sendVerificationCode: async (email) => {
    const res = await axios.post('/api/send-code', { email });
    return res.data;
  },

  verifyEmailWithCode: async (email, code) => {
    const res = await axios.post('/api/verify-code', { email, code });
    return res.data;
  },
};

export default authService;


