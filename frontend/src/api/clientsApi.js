import axiosClient from "./axiosClient";

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// In-memory cache for client list data
let _clientsCache = {
  key: "",
  data: null,
  timestamp: 0,
};

// In-flight request deduplication map
let _inFlightRequest = null;

function makeKey(search, includeArchived) {
  return `${(search || "").trim().toLowerCase()}_${includeArchived ? "1" : "0"}`;
}

export const clientsApi = {
  /**
   * Synchronously return cached clients if valid, otherwise null.
   * Useful for instant component initialization on navigation.
   */
  getCachedClients: ({ search = "", includeArchived = false } = {}) => {
    const key = makeKey(search, includeArchived);
    if (
      _clientsCache.data &&
      _clientsCache.key === key &&
      Date.now() - _clientsCache.timestamp < CACHE_TTL_MS
    ) {
      return _clientsCache.data;
    }
    return null;
  },

  /**
   * Invalidate cached client list data.
   */
  invalidateCache: () => {
    _clientsCache = { key: "", data: null, timestamp: 0 };
    _inFlightRequest = null;
  },

  /** 
   * Get all active/archived clients with nested projects.
   * Uses in-memory cache and in-flight promise deduplication.
   */
  getClients: async ({ search = "", includeArchived = false, forceRefresh = false } = {}) => {
    const key = makeKey(search, includeArchived);
    const now = Date.now();

    // 1. Return cached response if still fresh
    if (!forceRefresh && _clientsCache.data && _clientsCache.key === key && (now - _clientsCache.timestamp < CACHE_TTL_MS)) {
      return _clientsCache.data;
    }

    // 2. Reuse in-flight request if one is already pending for the same query
    if (_inFlightRequest && _inFlightRequest.key === key) {
      return _inFlightRequest.promise;
    }

    // 3. Dispatch network request
    const params = {};
    if (search && search.trim()) params.search = search.trim();
    if (includeArchived) params.include_archived = true;

    const requestPromise = (async () => {
      try {
        const res = await axiosClient.get("/clients", { params });
        _clientsCache = {
          key,
          data: res.data,
          timestamp: Date.now(),
        };
        return res.data;
      } finally {
        _inFlightRequest = null;
      }
    })();

    _inFlightRequest = { key, promise: requestPromise };
    return requestPromise;
  },
};

export default clientsApi;
