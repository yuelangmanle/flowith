import { useEffect } from "react";
import { useStore } from "./store";

export function useKeyboard() {
  const { setView, toggleSidebar, createConversation, view } = useStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + N: New conversation
      if (isCmd && e.key === "n") {
        e.preventDefault();
        createConversation();
        setView("chat");
        return;
      }

      // Ctrl/Cmd + /: Toggle sidebar
      if (isCmd && e.key === "/") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl/Cmd + ,: Settings
      if (isCmd && e.key === ",") {
        e.preventDefault();
        setView("settings");
        return;
      }

      // Ctrl/Cmd + Shift + R: Roundtable
      if (isCmd && e.shiftKey && e.key === "R") {
        e.preventDefault();
        setView("roundtable");
        return;
      }

      // Escape: Back to chat
      if (e.key === "Escape" && view !== "chat") {
        e.preventDefault();
        setView("chat");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView, toggleSidebar, createConversation, view]);
}
