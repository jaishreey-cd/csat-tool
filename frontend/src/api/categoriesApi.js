import axiosClient from "./axiosClient";

export const categoriesApi = {
  getCategories: async () => {
    const res = await axiosClient.get("/categories");
    return res.data;
  },

  createCategory: async (categoryData) => {
    const res = await axiosClient.post("/categories", categoryData);
    return res.data;
  },

  updateCategory: async (catId, categoryData) => {
    const res = await axiosClient.put(`/categories/${catId}`, categoryData);
    return res.data;
  },

  toggleCategory: async (catId) => {
    const res = await axiosClient.patch(`/categories/${catId}/toggle`);
    return res.data;
  },

  deleteCategory: async (catId) => {
    const res = await axiosClient.delete(`/categories/${catId}`);
    return res.data;
  },
};

export default categoriesApi;
