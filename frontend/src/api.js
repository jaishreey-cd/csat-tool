import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pmo_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally → clear session
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("pmo_token");
      localStorage.removeItem("pmo_user");
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  /** Standard username/password login */
  login: async (username_or_email, password) => {
    const res = await api.post("/auth/login", { username_or_email, password });
    return res.data; // { access_token, token_type, role, user }
  },

  /** Exchange Microsoft SSO access token for a backend JWT */
  ssoExchange: async (msAccessToken) => {
    const res = await api.post("/auth/sso/exchange", {
      ms_access_token: msAccessToken,
    });
    return res.data;
  },

  /** Get current user profile */
  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data;
  },

  /** Test admin-only route */
  testAdminRoute: async () => {
    const res = await api.get("/auth/admin-only");
    return res.data;
  },

  /** Test user route */
  testUserRoute: async () => {
    const res = await api.get("/auth/user-only");
    return res.data;
  },
};

export const dataApi = {
  /** Get dashboard overview stats */
  getStats: async () => {
    const res = await api.get("/data/stats");
    return res.data;
  },

  /** Get all clients */
  getClients: async () => {
    const res = await api.get("/data/clients");
    return res.data;
  },

  /** Get projects with optional search */
  getProjects: async (search = "", skip = 0, limit = 50) => {
    const res = await api.get("/data/projects", {
      params: { search, skip, limit },
    });
    return res.data;
  },

  /** Trigger CSV re-import */
  reimport: async () => {
    const res = await api.post("/data/reimport");
    return res.data;
  },
};

export default api;
