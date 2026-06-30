import React, { useState, useEffect } from "react";
import { Sparkles, Search, X } from "lucide-react";

interface Parameter {
  name: string;
  type?: string;
  value: string;
}

interface ParametersPanelProps {
  parameters: Parameter[];
  paramOverrides: Record<string, string>;
  onParamValueChange: (name: string, value: string) => void;
  setHoveredParam: (name: string | null) => void;
  setFocusedParam: (name: string | null) => void;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  parameters,
  paramOverrides,
  onParamValueChange,
  setHoveredParam,
  setFocusedParam,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search query when parameters change (e.g., new query pasted)
  useEffect(() => {
    setSearchQuery("");
  }, [parameters]);

  const filteredParams = parameters.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span>Substituted Params</span>
        </div>
        <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono text-[10px]">
          {parameters.length}
        </span>
      </div>

      {/* Parameter search bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search params or values..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 font-sans"
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
          <Search size={14} />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Editable parameter list */}
      <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
        {filteredParams.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-650 font-sans">
            No matches found
          </div>
        ) : (
          filteredParams.map((param, index) => (
            <div
              key={index}
              className="flex flex-col bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60 rounded p-2 text-xs font-mono transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setHoveredParam(param.name)}
              onMouseLeave={() => setHoveredParam(null)}
              onClick={() => {
                const inputEl = document.querySelector(
                  `input[data-param-input="${param.name}"]`
                ) as HTMLInputElement;
                if (inputEl) {
                  inputEl.focus();
                }
              }}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-amber-455 font-medium">{param.name}</span>
                {param.type && (
                  <span className="text-zinc-555 font-mono text-[9px]">
                    {param.type}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={paramOverrides[param.name] ?? param.value}
                data-param-input={param.name}
                onChange={(e) => onParamValueChange(param.name, e.target.value)}
                onFocus={() => {
                  setFocusedParam(param.name);
                  const element = document.querySelector(
                    `[data-formatted-param-token="${param.name}"]`
                  );
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }
                }}
                onBlur={() => setFocusedParam(null)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 text-[11px] font-mono focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                placeholder="value"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
