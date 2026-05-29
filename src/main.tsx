import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function isMobile(): boolean {
  if ((window as any).Capacitor) return true;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return false;
}

async function boot() {
  if (isMobile()) {
    const { MobileApp } = await import("./mobile/MobileApp");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode><MobileApp /></React.StrictMode>
    );
  } else {
    const { App } = await import("./App");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode><App /></React.StrictMode>
    );
  }
}

boot();
