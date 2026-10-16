import axiosClient from "./axiosClient";

const CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

// In-memory cache for survey list data
let _surveysCache = {
  key: "",
  data: null,
  timestamp: 0,
};

let _inFlightSurveysRequest = null;

function makeSurveysKey(params = {}) {
  return JSON.stringify(params);
}

function invalidateSurveysCache() {
  _surveysCache = { key: "", data: null, timestamp: 0 };
  _inFlightSurveysRequest = null;
}

export const surveysApi = {
  invalidateCache: invalidateSurveysCache,

  getCachedSurveys: (params = {}) => {
    const key = makeSurveysKey(params);
    if (
      _surveysCache.data &&
      _surveysCache.key === key &&
      Date.now() - _surveysCache.timestamp < CACHE_TTL_MS
    ) {
      return _surveysCache.data;
    }
    return null;
  },

  createSurvey: async (surveyData) => {
    const response = await axiosClient.post("/surveys", surveyData);
    invalidateSurveysCache();
    return response.data;
  },

  getSurveys: async (params = {}, forceRefresh = false) => {
    const key = makeSurveysKey(params);
    const now = Date.now();

    // 1. Return fresh cached surveys if available
    if (!forceRefresh && _surveysCache.data && _surveysCache.key === key && (now - _surveysCache.timestamp < CACHE_TTL_MS)) {
      return _surveysCache.data;
    }

    // 2. In-flight promise reuse
    if (_inFlightSurveysRequest && _inFlightSurveysRequest.key === key) {
      return _inFlightSurveysRequest.promise;
    }

    // 3. Network request
    const reqPromise = (async () => {
      try {
        const response = await axiosClient.get("/surveys", { params });
        _surveysCache = {
          key,
          data: response.data,
          timestamp: Date.now(),
        };
        return response.data;
      } finally {
        _inFlightSurveysRequest = null;
      }
    })();

    _inFlightSurveysRequest = { key, promise: reqPromise };
    return reqPromise;
  },

  getSurvey: async (id) => {
    const response = await axiosClient.get(`/surveys/${id}`);
    return response.data;
  },

  submitForApproval: async (id) => {
    const response = await axiosClient.post(`/surveys/${id}/submit-approval`);
    invalidateSurveysCache();
    return response.data;
  },

  dispatchSurvey: async (id, dispatchData) => {
    const response = await axiosClient.post(`/surveys/${id}/dispatch`, dispatchData);
    invalidateSurveysCache();
    return response.data;
  },

  sendReminder: async (id) => {
    const response = await axiosClient.post(`/surveys/${id}/remind`);
    invalidateSurveysCache();
    return response.data;
  },

  sendResponseFollowup: async (id, message = "") => {
    const response = await axiosClient.post(`/surveys/${id}/response-followup`, { message });
    invalidateSurveysCache();
    return response.data;
  },

  checkFollowups: async (thresholdDays = 7) => {
    const response = await axiosClient.post("/surveys/check-followups", null, {
      params: { threshold_days: thresholdDays },
    });
    invalidateSurveysCache();
    return response.data;
  },

  getPublicSurvey: async (token) => {
    const response = await axiosClient.get(`/surveys/public/${token}`);
    return response.data;
  },

  submitPublicSurvey: async (token, submissionData) => {
    const response = await axiosClient.post(`/surveys/public/${token}/submit`, submissionData);
    invalidateSurveysCache();
    return response.data;
  },

  getEmailStatus: async () => {
    const response = await axiosClient.get("/surveys/email-status");
    return response.data;
  },

  sendTestEmail: async (recipientEmail) => {
    const response = await axiosClient.post("/surveys/test-email", {
      recipient_email: recipientEmail,
    });
    return response.data;
  },

  getClientResponse: async (id) => {
    const response = await axiosClient.get(`/surveys/${id}/response`);
    return response.data;
  },
};

export default surveysApi;
