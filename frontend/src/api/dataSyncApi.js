import axiosClient from "./axiosClient";

export const dataSyncApi = {
  /** Upload file for diff preview without writing to DB */
  preview: async (file, mode = "add_update") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    const res = await axiosClient.post("/data/sync/preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** Apply import merge */
  confirm: async (file, mode = "add_update") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    const res = await axiosClient.post("/data/sync/confirm", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** Get import batches history */
  getImports: async () => {
    const res = await axiosClient.get("/data/imports");
    return res.data;
  },

  /** Rollback latest applied batch */
  rollback: async (batchId) => {
    const res = await axiosClient.post(`/data/imports/${batchId}/rollback`);
    return res.data;
  },
};

export default dataSyncApi;
