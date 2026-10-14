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
};

export default surveysApi;
