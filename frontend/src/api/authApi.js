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

  /** Get active admin count and limit status (Admin) */
  getAdminCount: async () => {
    const res = await axiosClient.get("/auth/admin-count");
    return res.data;
  },

  /** Update user permissions/role and active status */
  updateUserRole: async (userId, role, isActive = null) => {
    const payload = { role };
    if (isActive !== null) payload.is_active = isActive;
    const res = await axiosClient.put(`/auth/users/${userId}/permissions`, payload);
    return res.data;
  },

  /** Grant access to a user by entering their email, role, and assigned projects */
  grantUserAccess: async ({ email, role = "User", project_ids = [] }) => {
    const res = await axiosClient.post("/auth/users", {
      email,
      role,
      project_ids,
    });
    return res.data;
  },

  /** Assign projects to a user */
  assignUserProjects: async (userId, projectIds) => {
    const res = await axiosClient.put(`/auth/users/${userId}/projects`, {
      project_ids: projectIds,
    });
    return res.data;
  },

  /** Create/authorize a new user account (Admin) */
  createUser: async ({ email, password, full_name, role = "User", is_active = true, project_ids = [] }) => {
    const res = await axiosClient.post("/auth/users", {
      email,
      password,
      full_name,
      role,
      is_active,
      project_ids,
    });
    return res.data;
  },
};

export default authApi;
