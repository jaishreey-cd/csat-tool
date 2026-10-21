import axiosClient from "./axiosClient";

export const auditApi = {
  getLogs: async (params = {}) => {
    const res = await axiosClient.get("/audit", { params });
    return res.data;
  },
};

export default auditApi;
