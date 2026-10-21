import axiosClient from "./axiosClient";

const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

let _questionsCache = new Map();

function makeKey(params = {}) {
  return JSON.stringify(params);
}

export function invalidateQuestionsCache() {
  _questionsCache.clear();
}

export const questionsApi = {
  invalidateCache: invalidateQuestionsCache,

  getCachedQuestions: (params = {}) => {
    const key = makeKey(params);
    const entry = _questionsCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  },

  /**
   * List questions with optional section or phase filter.
   * @param {Object} params - { section: number, phase: string }
   * @param {boolean} forceRefresh
   */
  getQuestions: async (params = {}, forceRefresh = false) => {
    const key = makeKey(params);
    if (!forceRefresh) {
      const entry = _questionsCache.get(key);
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }
    const res = await axiosClient.get("/questions", { params });
    _questionsCache.set(key, { data: res.data, timestamp: Date.now() });
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
    invalidateQuestionsCache();
    return res.data;
  },

  /**
   * Update question template.
   */
  updateQuestion: async (id, questionData) => {
    const res = await axiosClient.put(`/questions/${id}`, questionData);
    invalidateQuestionsCache();
    return res.data;
  },

  /**
   * Permanently delete question from database.
   */
  deleteQuestion: async (id) => {
    const res = await axiosClient.delete(`/questions/${id}`);
    invalidateQuestionsCache();
    return res.data;
  },
};

export default questionsApi;
