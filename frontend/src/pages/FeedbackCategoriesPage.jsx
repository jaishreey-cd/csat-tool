import { useState, useEffect } from "react";
import categoriesApi from "../api/categoriesApi";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import Toast from "../components/Toast";

export default function FeedbackCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: "", description: "", order_index: 0, is_active: true });

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoriesApi.getCategories();
      setCategories(data || []);
    } catch (err) {
      setToast({ message: "Failed to load categories.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleToggle = async (cat) => {
    try {
      await categoriesApi.toggleCategory(cat.id);
      setToast({
        message: `Category '${cat.name}' is now ${cat.is_active ? "inactive" : "active"}.`,
        type: "success",
      });
      loadCategories();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to toggle status.", type: "error" });
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;
    try {
      await categoriesApi.deleteCategory(cat.id);
      setToast({ message: `Category '${cat.name}' deleted.`, type: "success" });
      loadCategories();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to delete category.", type: "error" });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: "Category name is required.", type: "error" });
      return;
    }
    try {
      if (formData.id) {
        await categoriesApi.updateCategory(formData.id, {
          name: formData.name.trim(),
          description: formData.description,
          order_index: Number(formData.order_index),
        });
        setToast({ message: "Category updated successfully.", type: "success" });
      } else {
        await categoriesApi.createCategory({
          name: formData.name.trim(),
          description: formData.description,
          order_index: Number(formData.order_index),
          is_active: formData.is_active,
        });
        setToast({ message: "Category created successfully.", type: "success" });
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Failed to save category.", type: "error" });
    }
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-white, #ffffff)", margin: 0 }}>
            Feedback Categories
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted, #94a3b8)", marginTop: "6px" }}>
            Create, edit, activate, deactivate and manage the feedback categories configured across survey sections.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setFormData({ id: null, name: "", description: "", order_index: categories.length + 1, is_active: true });
            setIsModalOpen(true);
          }}
        >
          + Add Category
        </Button>
      </div>

      {/* Categories Card List */}
      <div
        style={{
          background: "var(--bg-surface, #0d1b2a)",
          border: "1px solid var(--border, rgba(96, 165, 250, 0.12))",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Spinner size="lg" /></div>
        ) : categories.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #94a3b8)" }}>
            No categories found. Click "+ Add Category" to create one.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(96, 165, 250, 0.15))", textAlign: "left", color: "var(--text-muted, #94a3b8)" }}>
                  <th style={{ padding: "12px", width: "80px" }}>Order</th>
                  <th style={{ padding: "12px" }}>Category Name</th>
                  <th style={{ padding: "12px" }}>Description</th>
                  <th style={{ padding: "12px", width: "120px" }}>Status</th>
                  <th style={{ padding: "12px", width: "200px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => (
                  <tr
                    key={cat.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      color: "var(--text-main, #e2e8f0)",
                    }}
                  >
                    <td style={{ padding: "14px 12px", fontWeight: 700, color: "#60a5fa" }}>
                      #{cat.order_index || idx + 1}
                    </td>
                    <td style={{ padding: "14px 12px", fontWeight: 600, color: "#ffffff" }}>
                      {cat.name}
                    </td>
                    <td style={{ padding: "14px 12px", color: "var(--text-muted, #94a3b8)" }}>
                      {cat.description || "—"}
                    </td>
                    <td style={{ padding: "14px 12px" }}>
                      <Badge variant={cat.is_active ? "success" : "neutral"}>
                        {cat.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => handleToggle(cat)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: cat.is_active ? "rgba(234, 179, 8, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: cat.is_active ? "#facc15" : "#6ee7b7",
                            border: `1px solid ${cat.is_active ? "rgba(234, 179, 8, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                            cursor: "pointer",
                          }}
                        >
                          {cat.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              id: cat.id,
                              name: cat.name,
                              description: cat.description || "",
                              order_index: cat.order_index || idx + 1,
                              is_active: cat.is_active,
                            });
                            setIsModalOpen(true);
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#93c5fd",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "#f87171",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: "0 0 16px 0" }}>
              {formData.id ? "Edit Feedback Category" : "Add Feedback Category"}
            </h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Solution & Architecture"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                  required
                />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Scope and purpose of this feedback category..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff", resize: "none" }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>
                  Order Index (Section Sequence)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "#1e293b", border: "1px solid #334155", color: "#ffffff" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      )}
    </div>
  );
}
