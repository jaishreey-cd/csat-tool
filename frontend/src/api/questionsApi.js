import axiosClient from "./axiosClient";

export const questionsApi = {
  /**
   * List questions with optional section or phase filter.
   * @param {Object} params - { section: number, phase: string }
   */
  getQuestions: async (params = {}) => {
    const res = await axiosClient.get("/questions", { params });
    return res.data;
  },

  /**
   * Get single question template.
   */
  getQuestion: async (id) => {
    const res = await axiosClient.get(`/questions/${id}`);
    return res.data;
  },

  /**
   * Create new question in the Question Bank.
   */
  createQuestion: async (questionData) => {
    const res = await axiosClient.post("/questions", questionData);
    return res.data;
  },

  /**
   * Update question template.
   */
  updateQuestion: async (id, questionData) => {
    const res = await axiosClient.put(`/questions/${id}`, questionData);
    return res.data;
  },

  /**
   * Permanently delete question from database.
   */
  deleteQuestion: async (id) => {
    const res = await axiosClient.delete(`/questions/${id}`);
    return res.data;
  },
};

export default questionsApi;
