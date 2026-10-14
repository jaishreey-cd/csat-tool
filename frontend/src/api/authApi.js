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
};

export default authApi;
