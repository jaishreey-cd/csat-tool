import axiosClient from "./axiosClient";

const analyticsApi = {
  getSystemOverview: async () => {
    const response = await axiosClient.get("/analytics/overview");
    return response.data;
  },

  getProjectAnalytics: async (projectId) => {
    const response = await axiosClient.get(`/analytics/projects/${projectId}`);
    return response.data;
  },
};

export default analyticsApi;
