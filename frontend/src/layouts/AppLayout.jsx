import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep, #0a1628)", display: "flex" }}>
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div
        className="app-main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          marginLeft: "var(--sidebar-w, 260px)",
          minWidth: 0,
          paddingTop: "var(--topbar-h, 68px)",
          transition: "margin-left 0.25s ease",
        }}
      >
        <Topbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .app-main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
