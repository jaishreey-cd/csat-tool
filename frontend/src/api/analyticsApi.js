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

const analyticsApi = {
  getSystemOverview: async () => {
    const response = await axiosClient.get("/analytics/overview");
    return response.data;
  },

  getProjectAnalytics: async (projectId) => {
    const response = await axiosClient.get(`/analytics/projects/${projectId}`);
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
};

export default analyticsApi;
