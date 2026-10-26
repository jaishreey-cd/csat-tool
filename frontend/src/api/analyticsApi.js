import axiosClient from "./axiosClient";

export const sanitizeFilename = (name) => {
  if (!name) return "Survey_Export";
  return String(name).replace(/[\\/*?:"<>|]/g, "_").trim().replace(/^\.+/, "") || "Survey_Export";
};

const triggerDownload = (response, defaultFilename) => {
  const contentDisposition = response.headers["content-disposition"];
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename=["']?([^"']+)["']?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const _projectAnalyticsCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const analyticsApi = {
  getDashboardAnalytics: async (params = {}) => {
    const response = await axiosClient.get("/analytics/dashboard", { params });
    return response.data;
  },

  getSystemOverview: async () => {
    const response = await axiosClient.get("/analytics/overview");
    return response.data;
  },

  getCachedProjectAnalytics: (projectId) => {
    const entry = _projectAnalyticsCache.get(String(projectId));
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  },

  getProjectAnalytics: async (projectId, forceRefresh = false) => {
    const key = String(projectId);
    if (!forceRefresh) {
      const entry = _projectAnalyticsCache.get(key);
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }
    const response = await axiosClient.get(`/analytics/projects/${projectId}`);
    _projectAnalyticsCache.set(key, { data: response.data, timestamp: Date.now() });
    return response.data;
  },

  exportProjectAnalytics: async (projectId, format = "xlsx", customFilename = null) => {
    const response = await axiosClient.get(`/analytics/projects/${projectId}/export`, {
      params: { format },
      responseType: "blob",
    });
    triggerDownload(response, customFilename || `Project_${projectId}_CSAT_Report.${format}`);
  },

  exportSurveysRegistry: async (params = {}, format = "csv", customFilename = null) => {
    const response = await axiosClient.get("/analytics/surveys/export", {
      params: { ...params, format },
      responseType: "blob",
    });
    triggerDownload(response, customFilename || `CSAT_Surveys_Registry.${format}`);
  },

  exportOverview: async (format = "xlsx") => {
    const response = await axiosClient.get("/analytics/overview/export", {
      params: { format },
      responseType: "blob",
    });
    triggerDownload(response, `CSAT_Portfolio_Overview.${format}`);
  },

  assignProjectPmos: async (projectId, userIds) => {
    const response = await axiosClient.put(`/analytics/projects/${projectId}/assign-pmos`, {
      user_ids: userIds,
    });
    return response.data;
  },
};

export default analyticsApi;
