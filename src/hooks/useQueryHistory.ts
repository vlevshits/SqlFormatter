import { useState, useEffect } from "react";

export interface HistoryItem {
  id: string;
  timestamp: string;
  dialect: "mssql" | "postgres";
  rawInput: string;
  formattedOutput: string;
}

export function useQueryHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem("sql_formatter_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save to history
  const saveToHistory = (raw: string, formatted: string, dialect: "mssql" | "postgres") => {
    let wasAdded = false;
    setHistory((prev) => {
      // Check if it already exists to avoid duplicates
      if (prev.some((item) => item.rawInput.trim() === raw.trim())) return prev;

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        dialect,
        rawInput: raw,
        formattedOutput: formatted,
      };

      const updated = [newItem, ...prev].slice(0, 30);
      localStorage.setItem("sql_formatter_history", JSON.stringify(updated));
      wasAdded = true;
      return updated;
    });
    return wasAdded;
  };

  // Delete specific history item
  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("sql_formatter_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all history items
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("sql_formatter_history");
  };

  return {
    history,
    saveToHistory,
    deleteHistoryItem,
    clearHistory,
  };
}
