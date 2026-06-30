import React, { useState, useEffect } from "react";
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
  Eraser
} from "@phosphor-icons/react";
import { formatAndSubstituteQuery, FormatConfig, ParseResult } from "./utils/sqlParser";



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

  // Format the SQL whenever input, dialect, or configs change
  useEffect(() => {
    if (!inputSql.trim()) {
      setParseResult(null);
      setStats({ timeMs: 0, charReduction: 0, paramCount: 0 });
      return;
    }

    const start = performance.now();
    const result = formatAndSubstituteQuery(inputSql, dialect, config);
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
  }, [inputSql, dialect, config]);

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
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputSql(text);
        triggerToast("Pasted query from clipboard");
      } else {
        triggerToast("Clipboard is empty");
      }
    } catch (err) {
      triggerToast("Unable to read clipboard");
    }
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
  const renderHighlightedSql = (sql: string) => {
    const keywords = new Set([
      "SELECT", "FROM", "WHERE", "INNER", "JOIN", "LEFT", "OUTER", "RIGHT", "ON",
      "AND", "OR", "IN", "IS", "NULL", "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END",
      "UNION", "ALL", "TOP", "AS", "INTO", "CREATE", "TABLE", "INSERT", "UPDATE", "DELETE",
      "EXEC", "SP_EXECUTESQL", "WITH", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
      "OFFSET", "VALUES", "CROSS", "APPLY", "HAVING"
    ]);

    const tokenRegex = /(\s+|--.*|\/\*[\s\S]*?\*\/|N?'(?:''|[^'])*'|\[[^\]]+\]|"[^"]*"|[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?|[<>!=]+|[-+*/%,.()@$])/g;
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
        return <span key={i} className="text-amber-400 font-medium">{token}</span>;
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
          {parseResult && parseResult.success && parseResult.parameters.length > 0 && (
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
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {parseResult.parameters.map((param, index) => (
                  <div key={index} className="flex flex-col bg-zinc-900/60 border border-zinc-800/60 rounded p-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-amber-400 font-medium">{param.name}</span>
                      {param.type && <span className="text-zinc-600">{param.type}</span>}
                    </div>
                    <div className="text-zinc-300 text-[10px] break-all max-h-16 overflow-y-auto bg-zinc-950/40 p-1 border border-zinc-800/40 rounded">
                      {param.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
      <main className="flex-1 flex flex-col h-full bg-zinc-950">
        
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
        <section className="flex-1 flex overflow-hidden min-h-0">
          
          {/* A. Left Editor: Raw Input */}
          <div className="flex-1 border-r border-zinc-800 flex flex-col h-full min-w-[280px]">
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
            
            <div className="flex-1 relative">
              <textarea
                value={inputSql}
                onChange={(e) => setInputSql(e.target.value)}
                placeholder={
                  dialect === "mssql" 
                    ? "Paste MS SQL query logs here...\ne.g. exec sp_executesql N'SELECT * FROM Table WHERE id = @p1', N'@p1 int', @p1=10"
                    : "Paste PostgreSQL parameterized statement logs here...\ne.g. SELECT * FROM users WHERE status = $1;\n-- Parameters: $1 = 'active'"
                }
                className="w-full h-full p-4 bg-zinc-950 text-zinc-100 font-mono text-xs border-0 focus:outline-none focus:ring-0 resize-none leading-relaxed placeholder-zinc-700"
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
          <div className="flex-1 flex flex-col h-full min-w-[280px] bg-zinc-900/10">
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
                    {renderHighlightedSql(parseResult.formattedSql)}
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
