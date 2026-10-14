import axiosClient from "./axiosClient";

export const clientsApi = {
  /** Get all active/archived clients with nested projects */
  getClients: async ({ search = "", includeArchived = false } = {}) => {
    const params = {};
    if (search && search.trim()) params.search = search.trim();
    if (includeArchived) params.include_archived = true;
    
    const res = await axiosClient.get("/clients", { params });
    return res.data;
  },
};

export default clientsApi;
