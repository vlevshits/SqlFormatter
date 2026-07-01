import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { History, Trash2, Clipboard } from "lucide-react";
import { HistoryItem } from "../hooks/useQueryHistory";

interface HistoryPanelProps {
  history: HistoryItem[];
  onLoadHistory: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onLoadHistory,
  onDeleteHistoryItem,
  onClearHistory,
}) => {
  return (
    <div className="p-4 flex flex-col gap-2.5 flex-1 min-h-[160px]">
      <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <History size={14} />
          <span>Recent Queries</span>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-650 text-xs py-8">
          <Clipboard size={24} className="opacity-40 mb-2" />
          <p>No queries in history yet</p>
          <p className="text-[10px] text-zinc-700 mt-0.5">
            They will appear here when saved
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="group flex items-start gap-2 bg-zinc-900/40 border border-zinc-850 hover:border-zinc-750 rounded p-2 text-xs font-mono text-left cursor-pointer transition-colors hover:bg-zinc-900"
                onClick={() => onLoadHistory(item)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-1">
                    <span className="font-semibold text-zinc-400">
                      {item.dialect === "mssql" ? "MS SQL" : "Postgres"}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-zinc-300 truncate font-mono">
                    {item.rawInput}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHistoryItem(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 rounded transition-opacity cursor-pointer"
                  title="Remove from history"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
