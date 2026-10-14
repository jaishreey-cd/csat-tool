import axiosClient from "./axiosClient";

export const surveysApi = {
  createSurvey: async (surveyData) => {
    const response = await axiosClient.post("/surveys", surveyData);
    return response.data;
  },

  getSurveys: async (params = {}) => {
    const response = await axiosClient.get("/surveys", { params });
    return response.data;
  },

  getSurvey: async (id) => {
    const response = await axiosClient.get(`/surveys/${id}`);
    return response.data;
  },

  submitForApproval: async (id) => {
    const response = await axiosClient.post(`/surveys/${id}/submit-approval`);
    return response.data;
  },

  dispatchSurvey: async (id, dispatchData) => {
    const response = await axiosClient.post(`/surveys/${id}/dispatch`, dispatchData);
    return response.data;
  },

  getPublicSurvey: async (token) => {
    const response = await axiosClient.get(`/surveys/public/${token}`);
    return response.data;
  },

  submitPublicSurvey: async (token, submissionData) => {
    const response = await axiosClient.post(`/surveys/public/${token}/submit`, submissionData);
    return response.data;
  },
};

export default surveysApi;
