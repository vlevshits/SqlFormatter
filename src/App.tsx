import { useState, useEffect, useRef } from "react";
import { Database, Columns, Rows } from "lucide-react";
import { formatAndSubstituteQuery, FormatConfig, ParseResult } from "./utils/sqlParser";
import { invoke } from "@tauri-apps/api/core";
import { useQueryHistory, HistoryItem } from "./hooks/useQueryHistory";
import { SettingsPanel } from "./components/SettingsPanel";
import { ParametersPanel } from "./components/ParametersPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { RawSqlEditor } from "./components/RawSqlEditor";
import { FormattedSqlViewer } from "./components/FormattedSqlViewer";
import { Toast } from "./components/Toast";

function App() {
  const [dialect, setDialect] = useState<"mssql" | "postgres">("mssql");
  const [panelOrientation, setPanelOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [inputSql, setInputSql] = useState("");
  const [config, setConfig] = useState<FormatConfig>({
    tabWidth: 2,
    keywordCase: "upper",
    logicalOperatorNewline: "before",
  });

  const [paramOverrides, setParamOverrides] = useState<Record<string, string>>({});
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);
  const [focusedParam, setFocusedParam] = useState<string | null>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [stats, setStats] = useState({
    timeMs: 0,
    charReduction: 0,
    paramCount: 0,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Custom hook for history management
  const { history, saveToHistory, deleteHistoryItem, clearHistory } = useQueryHistory();

  // Refs for auto-saving behavior and raw editor scroll syncing
  const shouldAutoSaveRef = useRef(false);
  const rawPreRef = useRef<HTMLPreElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Clear overrides when inputSql or dialect changes
  useEffect(() => {
    setParamOverrides({});
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
        paramCount: result.parameters.length,
      });
    }
  }, [inputSql, dialect, config, paramOverrides]);

  // Auto-save history after typing or pasting
  useEffect(() => {
    if (!parseResult || !parseResult.success || !inputSql.trim()) return;

    if (shouldAutoSaveRef.current) {
      shouldAutoSaveRef.current = false;
      saveToHistory(inputSql, parseResult.formattedSql, dialect);
      return;
    }

    const timer = setTimeout(() => {
      saveToHistory(inputSql, parseResult.formattedSql, dialect);
    }, 2000);

    return () => clearTimeout(timer);
  }, [parseResult, inputSql, dialect, saveToHistory]);

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

  // Paste from clipboard button action
  const handlePasteClick = async () => {
    try {
      const text = await invoke<string>("read_clipboard");
      if (text) {
        shouldAutoSaveRef.current = true;
        setInputSql(text);
        triggerToast("Pasted query from clipboard");
      } else {
        triggerToast("Clipboard is empty");
      }
    } catch (err) {
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

  // Save query manually to history
  const handleSaveToHistory = () => {
    if (!parseResult || !parseResult.success) return;

    const added = saveToHistory(inputSql, parseResult.formattedSql, dialect);
    if (added) {
      triggerToast("Saved query to history");
    } else {
      triggerToast("Query already in history");
    }
  };

  // Load item from history
  const handleLoadHistory = (item: HistoryItem) => {
    setDialect(item.dialect);
    setInputSql(item.rawInput);
    triggerToast("Loaded query from history");
  };

  // Delete item from history
  const handleDeleteHistoryItem = (id: string) => {
    deleteHistoryItem(id);
    triggerToast("Deleted history item");
  };

  // Clear all history
  const handleClearHistory = () => {
    clearHistory();
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
      // 1. Whitespace or Comments
      if (/^\s+$/.test(token)) {
        return token;
      }
      if (token.startsWith("--") || token.startsWith("/*")) {
        return <span key={i} className="text-zinc-600 italic select-none">{token}</span>;
      }
      // 2. String Literals
      if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith("N'") && token.endsWith("'"))) {
        return <span key={i} className="text-emerald-400 font-mono break-all">{token}</span>;
      }
      // 3. Brackets/Identifiers
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
              e.stopPropagation();
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
      // 6. Default (Numbers, Operators, identifiers)
      if (/^[0-9]+(?:\.[0-9]+)?$/.test(token)) {
        return <span key={i} className="text-amber-500 font-mono">{token}</span>;
      }
      if (/^[<>!=]+$/.test(token)) {
        return <span key={i} className="text-zinc-400 font-semibold">{token}</span>;
      }
      return <span key={i} className="text-zinc-300">{token}</span>;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-blue-600/30 selection:text-blue-100">
      
      {/* 1. LEFT SIDEBAR CONTAINER */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col h-full shrink-0">
        
        {/* Logo / App Branding */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
              <Database size={18} />
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

        {/* Settings Panel */}
        <SettingsPanel config={config} onChange={setConfig} />

        {/* Scrollable list: Parameters & History */}
        <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-zinc-800">
          
          {/* Substituted Parameters */}
          {parseResult && parseResult.success && parseResult.parameters.length > 0 && (
            <ParametersPanel
              parameters={parseResult.parameters}
              paramOverrides={paramOverrides}
              onParamValueChange={handleParamValueChange}
              setHoveredParam={setHoveredParam}
              setFocusedParam={setFocusedParam}
            />
          )}

          {/* History Panel */}
          <HistoryPanel
            history={history}
            onLoadHistory={handleLoadHistory}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onClearHistory={handleClearHistory}
          />
        </div>
      </aside>

      {/* 2. RIGHT / MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full bg-zinc-950 min-w-0">
        
        {/* Workspace Top Bar */}
        <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
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

          {/* Panel Orientation Switcher */}
          <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setPanelOrientation("vertical")}
              className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
                panelOrientation === "vertical"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Side-by-Side (Columns)"
            >
              <Columns size={15} />
            </button>
            <button
              onClick={() => setPanelOrientation("horizontal")}
              className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
                panelOrientation === "horizontal"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Top-and-Bottom (Rows)"
            >
              <Rows size={15} />
            </button>
          </div>
        </header>

        {/* Split pane for raw query and formatted result */}
        <section className={`flex-1 flex overflow-hidden min-h-0 min-w-0 ${
          panelOrientation === "vertical" ? "flex-row" : "flex-col"
        }`}>
          
          {/* Raw SQL Editor */}
          <RawSqlEditor
            inputSql={inputSql}
            setInputSql={setInputSql}
            dialect={dialect}
            rawPreRef={rawPreRef}
            rawTextareaRef={rawTextareaRef}
            onPasteClick={handlePasteClick}
            renderHighlightedSql={renderHighlightedSql}
            triggerToast={triggerToast}
            panelOrientation={panelOrientation}
          />

          {/* Formatted SQL Viewer */}
          <FormattedSqlViewer
            parseResult={parseResult}
            renderHighlightedSql={renderHighlightedSql}
            onSaveToHistory={handleSaveToHistory}
            onDownload={handleDownload}
            onCopy={handleCopy}
            copySuccess={copySuccess}
            dialect={dialect}
            stats={stats}
          />
        </section>
      </main>

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}

export default App;
