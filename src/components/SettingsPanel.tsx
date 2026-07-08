import React from "react";
import { Settings } from "lucide-react";
import { FormatConfig } from "../utils/sqlParser";

interface SettingsPanelProps {
  config: FormatConfig;
  onChange: (config: FormatConfig) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onChange }) => {
  return (
    <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
        <Settings size={14} />
        <span>Formatter Settings</span>
      </div>

      {/* Indent option */}
      <div className="flex flex-col gap-1 text-xs">
        <label className="text-zinc-500">Indentation</label>
        <select
          value={config.tabWidth}
          onChange={(e) => onChange({ ...config, tabWidth: parseInt(e.target.value) })}
          className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value={2}>2 Spaces</option>
          <option value={4}>4 Spaces</option>
        </select>
      </div>

      {/* Keyword casing option */}
      <div className="flex flex-col gap-1 text-xs">
        <label className="text-zinc-500">Keyword Casing</label>
        <select
          value={config.keywordCase}
          onChange={(e) => onChange({ ...config, keywordCase: e.target.value as any })}
          className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="upper">UPPERCASE</option>
          <option value="lower">lowercase</option>
          <option value="preserve">Preserve Casing</option>
        </select>
      </div>

      {/* Operator layout option */}
      <div className="flex flex-col gap-1 text-xs">
        <label className="text-zinc-500">Newline on Logical Operators</label>
        <select
          value={config.logicalOperatorNewline}
          onChange={(e) => onChange({ ...config, logicalOperatorNewline: e.target.value as any })}
          className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="before">Before operator (AND / OR)</option>
          <option value="after">After operator</option>
        </select>
      </div>

      {/* Remove comments option */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-800/50 mt-1">
        <label htmlFor="removeComments" className="text-zinc-400 cursor-pointer select-none font-medium">Remove Comments</label>
        <button
          id="removeComments"
          type="button"
          onClick={() => onChange({ ...config, removeComments: !config.removeComments })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            config.removeComments ? "bg-blue-600" : "bg-zinc-800"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-100 shadow ring-0 transition duration-200 ease-in-out ${
              config.removeComments ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
};
