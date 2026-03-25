import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppLogo } from "./components/AppLogo";

function App() {
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const minBtn = document.getElementById("titlebar-minimize");
    const maxBtn = document.getElementById("titlebar-maximize");
    const closeBtn = document.getElementById("titlebar-close");
    const dragEl = document.getElementById("titlebar-drag");
    minBtn?.addEventListener("click", () => appWindow.minimize());
    maxBtn?.addEventListener("click", () => appWindow.toggleMaximize());
    closeBtn?.addEventListener("click", () => appWindow.close());
    dragEl?.addEventListener("mousedown", (e) => {
      if (e.buttons === 1) appWindow.startDragging();
    });
  }, []);

  return (
    <>
      <div
        className="titlebar"
        style={{
          height: 40,
          background: "#fff",
          userSelect: "none",
          display: "flex",
          alignItems: "stretch",
          paddingLeft: 8,
          paddingRight: 0,
          gap: 0,
        }}
      >
        <AppLogo variant="titlebar" alt="" />
        <div
          id="titlebar-drag"
          data-tauri-drag-region
          style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", cursor: "default", fontSize: 14, color: "#333" }}
        >
          ClawScope - 记忆可见，进化可期
        </div>
        <div style={{ display: "flex", height: 40 }}>
          <button id="titlebar-minimize" type="button" className="win-titlebar-btn" title="最小化">&#xE921;</button>
          <button id="titlebar-maximize" type="button" className="win-titlebar-btn" title="最大化">&#xE922;</button>
          <button id="titlebar-close" type="button" className="win-titlebar-btn" title="关闭">&#xE8BB;</button>
        </div>
      </div>
      <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 640, marginTop: 0 }}>
        <AppLogo variant="hero" alt="ClawScope" />
        <h1 style={{ margin: 0 }}>ClawScope</h1>
        <p style={{ color: "#666", margin: "4px 0 16px" }}>记忆可见，进化可期</p>
        <p style={{ color: "#888", fontSize: 14 }}>OpenClaw 记忆与进化管理工具 · MVP 占位</p>
      </div>
    </>
  );
}

export default App;
