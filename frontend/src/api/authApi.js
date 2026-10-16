import axiosClient from "./axiosClient";

export const authApi = {
  /** Authenticate with email and password */
  login: async (email, password) => {
    const res = await axiosClient.post("/auth/login", { email, password });
    return res.data;
  },

  /** Get current user profile */
  getMe: async () => {
    const res = await axiosClient.get("/auth/me");
    return res.data;
  },

  /** Get all users (Admin) */
  getUsers: async () => {
    const res = await axiosClient.get("/auth/users");
    return res.data;
  },

  /** Update user permissions/role */
  updateUserRole: async (userId, role) => {
    const res = await axiosClient.put(`/auth/users/${userId}/permissions`, { role });
    return res.data;
  },
};

export default authApi;
