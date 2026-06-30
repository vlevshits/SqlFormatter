import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Sparkle, 
  Trash, 
  Copy, 
  Check, 
  FileText, 
  ClockCounterClockwise, 
  ClipboardText,
  ArrowsClockwise, 
  Gear,
  Download,
  Terminal,
  Eraser,
  MagnifyingGlass,
  X
} from "@phosphor-icons/react";
import { formatAndSubstituteQuery, FormatConfig, ParseResult } from "./utils/sqlParser";
import { invoke } from "@tauri-apps/api/core";



interface HistoryItem {
  id: string;
  timestamp: string;
  dialect: "mssql" | "postgres";
  rawInput: string;
  formattedOutput: string;
}

function App() {
  const [dialect, setDialect] = useState<"mssql" | "postgres">("mssql");
  const [inputSql, setInputSql] = useState("");
  const [config, setConfig] = useState<FormatConfig>({
    tabWidth: 2,
    keywordCase: "upper",
    logicalOperatorNewline: "before"
  });
  
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    timeMs: 0,
    charReduction: 0,
    paramCount: 0
  });

  // State variables for parameter overrides, search filtering, and interactions
  const [paramOverrides, setParamOverrides] = useState<Record<string, string>>({});
  const [paramSearchQuery, setParamSearchQuery] = useState("");
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);
  const [focusedParam, setFocusedParam] = useState<string | null>(null);

  // Refs for auto-saving behavior and raw editor scroll syncing
  const shouldAutoSaveRef = useRef(false);
  const rawPreRef = useRef<HTMLPreElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Disable default browser context menu globally to prevent native popups
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    return () => document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
  }, []);

  // Global keydown handler to intercept Cmd+V / Ctrl+V and append to raw SQL
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isPaste = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v";
      if (!isPaste) return;

      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      // If focusing settings or search or parameter inputs, let default paste happen
      if (isInput && activeEl.tagName === "INPUT") {
        return;
      }

      e.preventDefault();

      try {
        const text = await invoke<string>("read_clipboard");
        if (text) {
          shouldAutoSaveRef.current = true;
          setInputSql((prev) => {
            const separator = prev.trim() ? "\n\n" : "";
            return prev + separator + text;
          });
          triggerToast("Appended query from clipboard");
        }
      } catch (err) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            shouldAutoSaveRef.current = true;
            setInputSql((prev) => {
              const separator = prev.trim() ? "\n\n" : "";
              return prev + separator + text;
            });
            triggerToast("Appended query from clipboard");
          }
        } catch (e) {
          triggerToast("Unable to read clipboard");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Clear overrides and search query when inputSql or dialect changes
  useEffect(() => {
    setParamOverrides({});
    setParamSearchQuery("");
  }, [inputSql, dialect]);

  // Sync scroll positions when inputSql changes (e.g. on paste or load from history)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawPreRef.current && rawTextareaRef.current) {
        rawPreRef.current.scrollTop = rawTextareaRef.current.scrollTop;
        rawPreRef.current.scrollLeft = rawTextareaRef.current.scrollLeft;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [inputSql]);

  // Format the SQL whenever input, dialect, configs, or paramOverrides change
  useEffect(() => {
    if (!inputSql.trim()) {
      setParseResult(null);
      setStats({ timeMs: 0, charReduction: 0, paramCount: 0 });
      return;
    }

    const start = performance.now();
    const result = formatAndSubstituteQuery(inputSql, dialect, config, paramOverrides);
    const end = performance.now();

    setParseResult(result);

    if (result.success) {
      const origLen = inputSql.length;
      const newLen = result.formattedSql.length;
      setStats({
        timeMs: Math.round((end - start) * 10) / 10,
        charReduction: origLen - newLen,
        paramCount: result.parameters.length
      });
    } else {
      setStats({ timeMs: 0, charReduction: 0, paramCount: 0 });
    }
  }, [inputSql, dialect, config, paramOverrides]);

  // Helper to save history item directly (and ensure we don't save duplicates)
  const saveToHistoryDirectly = (raw: string, formatted: string, currentDialect: "mssql" | "postgres") => {
    setHistory((prev) => {
      if (prev.some((item) => item.rawInput.trim() === raw.trim())) return prev;
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        dialect: currentDialect,
        rawInput: raw,
        formattedOutput: formatted,
      };
      const updated = [newItem, ...prev].slice(0, 30);
      localStorage.setItem("sql_formatter_history", JSON.stringify(updated));
      return updated;
    });
  };

  // Auto-Save Effect (immediate on paste, debounced on typing)
  useEffect(() => {
    if (!parseResult || !parseResult.success || !inputSql.trim()) return;

    // Check if already in history
    const exists = history.some(item => item.rawInput.trim() === inputSql.trim());
    if (exists) return;

    if (shouldAutoSaveRef.current) {
      shouldAutoSaveRef.current = false;
      saveToHistoryDirectly(inputSql, parseResult.formattedSql, dialect);
      return;
    }

    const timer = setTimeout(() => {
      saveToHistoryDirectly(inputSql, parseResult.formattedSql, dialect);
    }, 2000);

    return () => clearTimeout(timer);
  }, [parseResult, inputSql, dialect, history]);

  // Show a temporary message toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!parseResult || !parseResult.success) return;
    try {
      await navigator.clipboard.writeText(parseResult.formattedSql);
      setCopySuccess(true);
      triggerToast("Formatted SQL copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      triggerToast("Failed to copy text");
    }
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      // Use Tauri command to read from clipboard to bypass WebKit permission popups
      const text = await invoke<string>("read_clipboard");
      if (text) {
        shouldAutoSaveRef.current = true;
        setInputSql(text);
        triggerToast("Pasted query from clipboard");
      } else {
        triggerToast("Clipboard is empty");
      }
    } catch (err) {
      // Fallback to browser clipboard if Tauri command fails or in browser dev environment
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          shouldAutoSaveRef.current = true;
          setInputSql(text);
          triggerToast("Pasted query from clipboard");
        } else {
          triggerToast("Clipboard is empty");
        }
      } catch (e) {
        triggerToast("Unable to read clipboard");
      }
    }
  };

  // Handle parameter value change, update overrides, and scroll to position
  const handleParamValueChange = (name: string, newValue: string) => {
    setParamOverrides((prev) => ({
      ...prev,
      [name]: newValue,
    }));
    
    setTimeout(() => {
      const element = document.querySelector(`[data-formatted-param-token="${name}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 50);
  };

  // Save query to history
  const handleSaveToHistory = () => {
    if (!parseResult || !parseResult.success) return;
    
    // Check if it already exists to avoid duplicates
    if (history.some(item => item.rawInput.trim() === inputSql.trim())) {
      triggerToast("Query already in history");
      return;
    }

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dialect,
      rawInput: inputSql,
      formattedOutput: parseResult.formattedSql
    };

    const updated = [newItem, ...history].slice(0, 30); // Keep top 30
    setHistory(updated);
    localStorage.setItem("sql_formatter_history", JSON.stringify(updated));
    triggerToast("Saved query to history");
  };

  // Load item from history
  const handleLoadHistory = (item: HistoryItem) => {
    setDialect(item.dialect);
    setInputSql(item.rawInput);
    triggerToast("Loaded query from history");
  };

  // Delete item from history
  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("sql_formatter_history", JSON.stringify(updated));
    triggerToast("Deleted history item");
  };

  // Clear all history
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("sql_formatter_history");
    triggerToast("History cleared");
  };

  // Download SQL file
  const handleDownload = () => {
    if (!parseResult || !parseResult.success) return;
    const element = document.createElement("a");
    const file = new Blob([parseResult.formattedSql], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `formatted_${dialect}_query.sql`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    triggerToast("SQL file downloaded");
  };

  // Custom SQL syntax highlighter
  const renderHighlightedSql = (sql: string, substitute: boolean = false) => {
    const keywords = new Set([
      "SELECT", "FROM", "WHERE", "INNER", "JOIN", "LEFT", "OUTER", "RIGHT", "ON",
      "AND", "OR", "IN", "IS", "NULL", "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END",
      "UNION", "ALL", "TOP", "AS", "INTO", "CREATE", "TABLE", "INSERT", "UPDATE", "DELETE",
      "EXEC", "SP_EXECUTESQL", "WITH", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
      "OFFSET", "VALUES", "CROSS", "APPLY", "HAVING"
    ]);

    const tokenRegex = /(\s+|--.*|\/\*[\s\S]*?\*\/|N?'(?:''|[^'])*'|\[[^\]]+\]|"[^"]*"|@[a-zA-Z0-9_]+|\$[0-9]+|[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?|[<>!=]+|[-+*/%,.()@$])/g;
    const tokens = sql.split(tokenRegex);

    return tokens.map((token, i) => {
      if (!token) return null;

      // 1. Comments
      if (token.startsWith("--") || token.startsWith("/*")) {
        return <span key={i} className="text-zinc-500 italic font-light">{token}</span>;
      }
      // 2. Strings
      if (token.startsWith("'") || token.startsWith("N'")) {
        return <span key={i} className="text-emerald-400 font-normal">{token}</span>;
      }
      // 3. Bracketed columns or double quoted string
      if ((token.startsWith("[") && token.endsWith("]")) || (token.startsWith('"') && token.endsWith('"'))) {
        return <span key={i} className="text-cyan-400 font-semibold">{token}</span>;
      }
      // 4. Keywords
      if (keywords.has(token.toUpperCase())) {
        return <span key={i} className="text-indigo-400 font-medium">{token}</span>;
      }
      // 5. Parameters
      if (token.startsWith("@") || token.startsWith("$")) {
        const activeParam = hoveredParam || focusedParam;
        const isActive = token.toLowerCase() === activeParam?.toLowerCase();
        
        // For raw input, do not render interactive pills with padding/borders/events
        // as it breaks the alignment and text selection of the underlying textarea.
        // Instead, just render it as a simple colored span!
        if (!substitute) {
          return (
            <span 
              key={i} 
              data-raw-param-token={token}
              className={`transition-colors duration-150 ${
                isActive ? "text-amber-300 bg-amber-500/20 font-semibold rounded-sm" : "text-amber-400"
              }`}
            >
              {token}
            </span>
          );
        }

        let displayValue = token;
        if (substitute && parseResult && parseResult.success) {
          const paramObj = parseResult.parameters.find(p => p.name.toLowerCase() === token.toLowerCase());
          if (paramObj) {
            displayValue = paramObj.value;
          }
        }

        return (
          <span 
            key={i} 
            data-formatted-param-token={token}
            className={`transition-all duration-200 px-1 py-0.5 rounded font-mono font-medium ${
              isActive
                ? "bg-amber-500 text-zinc-950 font-bold shadow-[0_0_8px_rgba(245,158,11,0.6)] scale-105"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-455 hover:bg-amber-500/20 cursor-pointer"
            }`}
            onClick={(e) => {
              e.stopPropagation(); // Avoid triggering parent div click
              const inputEl = document.querySelector(`input[data-param-input="${token}"]`) as HTMLInputElement;
              if (inputEl) {
                inputEl.focus();
                inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
          >
            {displayValue}
          </span>
        );
      }
      // 6. Numbers
      if (/^[0-9]+(?:\.[0-9]+)?$/.test(token)) {
        return <span key={i} className="text-violet-400">{token}</span>;
      }
      // 7. Operators / Separators
      if (/[<>!=+\-*/%,.()]/ .test(token)) {
        return <span key={i} className="text-zinc-500 font-light">{token}</span>;
      }

      // Default text
      return <span key={i} className="text-zinc-300">{token}</span>;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-blue-600/30 selection:text-blue-100">
      
      {/* 1. LEFT PANEL: Configurations, Parameters & History */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col h-full shrink-0">
        
        {/* Logo / App Branding */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
              <Database size={18} weight="bold" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">SQL Formatter</h1>
              <p className="text-[10px] text-zinc-500 font-mono">PARAMETER FORMATTER</p>
            </div>
          </div>
          <div className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono border border-zinc-700/50">
            v1
          </div>
        </div>

        {/* Configurations Section */}
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Gear size={14} />
            <span>Formatter Settings</span>
          </div>

          {/* Indent option */}
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-zinc-500">Indentation</label>
            <select 
              value={config.tabWidth}
              onChange={(e) => setConfig({ ...config, tabWidth: parseInt(e.target.value) })}
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
              onChange={(e) => setConfig({ ...config, keywordCase: e.target.value as any })}
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
              onChange={(e) => setConfig({ ...config, logicalOperatorNewline: e.target.value as any })}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500/60"
            >
              <option value="before">Before operator (AND / OR)</option>
              <option value="after">After operator</option>
            </select>
          </div>
        </div>

        {/* Scrollable list: Parameters & History */}
        <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-zinc-800">
          
          {/* Substituted Parameters Info */}
          {parseResult && parseResult.success && parseResult.parameters.length > 0 && (() => {
            const filteredParams = parseResult.parameters.filter(p => 
              p.name.toLowerCase().includes(paramSearchQuery.toLowerCase()) || 
              p.value.toLowerCase().includes(paramSearchQuery.toLowerCase())
            );

            return (
              <div className="p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Sparkle size={14} className="text-amber-400" />
                    <span>Substituted Params</span>
                  </div>
                  <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    {parseResult.parameters.length}
                  </span>
                </div>

                {/* Parameter search bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={paramSearchQuery}
                    onChange={(e) => setParamSearchQuery(e.target.value)}
                    placeholder="Search params or values..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/60 font-sans"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    <MagnifyingGlass size={14} />
                  </div>
                  {paramSearchQuery && (
                    <button
                      onClick={() => setParamSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Editable parameter list */}
                <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredParams.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-650 font-sans">No matches found</div>
                  ) : (
                    filteredParams.map((param, index) => (
                      <div 
                        key={index} 
                        className="flex flex-col bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60 rounded p-2 text-xs font-mono transition-all duration-150 cursor-pointer"
                        onMouseEnter={() => setHoveredParam(param.name)}
                        onMouseLeave={() => setHoveredParam(null)}
                        onClick={() => {
                          const inputEl = document.querySelector(`input[data-param-input="${param.name}"]`) as HTMLInputElement;
                          if (inputEl) {
                            inputEl.focus();
                          }
                        }}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-amber-455 font-medium">{param.name}</span>
                          {param.type && <span className="text-zinc-550 font-mono text-[9px]">{param.type}</span>}
                        </div>
                        <input
                          type="text"
                          value={paramOverrides[param.name] ?? param.value}
                          data-param-input={param.name}
                          onChange={(e) => handleParamValueChange(param.name, e.target.value)}
                          onFocus={() => {
                            setFocusedParam(param.name);
                            const element = document.querySelector(`[data-formatted-param-token="${param.name}"]`);
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
          })()}

          {/* Query History */}
          <div className="p-4 flex flex-col gap-2.5 flex-1 min-h-[160px]">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <ClockCounterClockwise size={14} />
                <span>Recent Queries</span>
              </div>
              {history.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Trash size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-600 text-xs py-8">
                <ClipboardText size={24} className="opacity-40 mb-2" />
                <p>No queries in history yet</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">They will appear here when saved</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="group flex items-start gap-2 bg-zinc-900/40 border border-zinc-850 hover:border-zinc-750 rounded p-2 text-xs font-mono text-left cursor-pointer transition-colors hover:bg-zinc-900"
                      onClick={() => handleLoadHistory(item)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-1">
                          <span className="font-semibold text-zinc-400">{item.dialect === "mssql" ? "MS SQL" : "Postgres"}</span>
                          <span>{item.timestamp}</span>
                        </div>
                        <div className="text-[11px] text-zinc-300 truncate font-mono">
                          {item.rawInput}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-0.5 rounded transition-opacity cursor-pointer"
                        title="Remove from history"
                      >
                        <Trash size={12} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. RIGHT / MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full bg-zinc-950 min-w-0">
        
        {/* Workspace Top Bar */}
        <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
          
          {/* Dialect Switcher pills */}
          <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setDialect("mssql")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                dialect === "mssql"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Microsoft SQL
            </button>
            <button
              onClick={() => setDialect("postgres")}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                dialect === "postgres"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              PostgreSQL
            </button>
          </div>


        </header>

        {/* Split pane for raw query and formatted result */}
        <section className="flex-1 flex overflow-hidden min-h-0 min-w-0">
          
          {/* A. Left Editor: Raw Input */}
          <div className="flex-1 basis-1/2 border-r border-zinc-800 flex flex-col h-full min-w-0">
            <div className="p-3 bg-zinc-900/20 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-500 uppercase font-mono">
              <div className="flex items-center gap-1.5">
                <Terminal size={14} />
                <span>Raw Parameterized SQL Input</span>
              </div>
              <div className="flex items-center gap-3 normal-case text-zinc-400">
                <button
                  onClick={handlePaste}
                  className="hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardText size={14} />
                  <span>Paste</span>
                </button>
                {inputSql && (
                  <button
                    onClick={() => {
                      setInputSql("");
                      triggerToast("Cleared input");
                    }}
                    className="hover:text-zinc-200 flex items-center gap-1 cursor-pointer border-l border-zinc-800 pl-3"
                  >
                    <Eraser size={14} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 relative overflow-hidden bg-zinc-950">
              {inputSql && (
                <pre
                  ref={rawPreRef}
                  className="absolute inset-0 w-full h-full p-4 bg-transparent text-zinc-300 font-mono text-xs leading-relaxed pointer-events-none whitespace-pre-wrap break-all overflow-hidden"
                  aria-hidden="true"
                >
                  {renderHighlightedSql(inputSql, false)}
                </pre>
              )}
              
              <textarea
                ref={rawTextareaRef}
                value={inputSql}
                onChange={(e) => setInputSql(e.target.value)}
                onPaste={() => {
                  shouldAutoSaveRef.current = true;
                }}
                onScroll={(e) => {
                  if (rawPreRef.current) {
                    rawPreRef.current.scrollTop = e.currentTarget.scrollTop;
                    rawPreRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                placeholder={
                  dialect === "mssql" 
                    ? "Paste MS SQL query logs here...\ne.g. exec sp_executesql N'SELECT * FROM Table WHERE id = @p1', N'@p1 int', @p1=10"
                    : "Paste PostgreSQL parameterized statement logs here...\ne.g. SELECT * FROM users WHERE status = $1;\n-- Parameters: $1 = 'active'"
                }
                className={`absolute inset-0 w-full h-full p-4 bg-transparent font-mono text-xs border-0 focus:outline-none focus:ring-0 resize-none leading-relaxed placeholder-zinc-700 whitespace-pre-wrap break-all overflow-y-auto ${
                  inputSql ? "text-transparent caret-zinc-100 selection:bg-blue-600/30" : "text-zinc-100"
                }`}
              />
              
              {!inputSql && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                  <Database size={48} className="mb-2" />
                  <span className="text-xs">Paste or Drag Query File Here</span>
                </div>
              )}
            </div>


          </div>

          {/* B. Right Editor: Formatted & Substituted Output */}
          <div className="flex-1 basis-1/2 flex flex-col h-full min-w-0 bg-zinc-900/10">
            <div className="p-3 bg-zinc-900/20 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-500 uppercase font-mono">
              <div className="flex items-center gap-1.5">
                <FileText size={14} />
                <span>Formatted Query Output</span>
              </div>
              {parseResult && parseResult.success && (
                <button
                  onClick={handleSaveToHistory}
                  className="hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                  title="Save to history"
                >
                  <ClockCounterClockwise size={12} />
                  <span>Save</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-4 overflow-auto bg-zinc-950 font-mono text-xs select-text whitespace-pre leading-relaxed border-0 relative">
              {parseResult ? (
                parseResult.success ? (
                  <code className="block select-text font-mono">
                    {renderHighlightedSql(parseResult.formattedTemplateSql || parseResult.formattedSql, true)}
                  </code>
                ) : (
                  <div className="text-red-400 font-mono p-2 border border-red-900/50 bg-red-950/20 rounded">
                    <span className="font-semibold text-xs block mb-1">Parsing Error:</span>
                    <span className="text-[11px] block">{parseResult.error}</span>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-700 text-xs font-sans pointer-events-none">
                  <ArrowsClockwise size={32} className="opacity-40 animate-pulse mb-2" />
                  <span>Waiting for query input...</span>
                </div>
              )}

              {/* Action overlay buttons when output exists */}
              {parseResult && parseResult.success && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    className="w-8 h-8 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 flex items-center justify-center transition-all cursor-pointer"
                    title="Download SQL"
                  >
                    <Download size={14} />
                  </button>
                  {/* Copy */}
                  <button
                    onClick={handleCopy}
                    className={`h-8 px-3 text-xs rounded-md border flex items-center gap-1.5 transition-all cursor-pointer ${
                      copySuccess
                        ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850"
                    }`}
                  >
                    {copySuccess ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                    <span>{copySuccess ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Output stats footer */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/20 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <div className="flex items-center gap-4">
                <span>Dialect: <strong className="text-zinc-400">{dialect === "mssql" ? "MS SQL" : "Postgres"}</strong></span>
                {parseResult?.success && (
                  <span>Substituted: <strong className="text-zinc-400">{stats.paramCount} params</strong></span>
                )}
              </div>
              {parseResult?.success && (
                <span>Time: <strong className="text-zinc-400">{stats.timeMs}ms</strong></span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Global micro-toast notification overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs px-3.5 py-2.5 rounded-lg shadow-xl shadow-black/50"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
