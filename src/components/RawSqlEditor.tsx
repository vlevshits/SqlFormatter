import React from "react";
import { Terminal, Clipboard, Eraser, Database } from "lucide-react";

interface RawSqlEditorProps {
  inputSql: string;
  setInputSql: (val: string) => void;
  dialect: "mssql" | "postgres";
  rawPreRef: React.RefObject<HTMLPreElement | null>;
  rawTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onPasteClick: () => void;
  renderHighlightedSql: (sql: string, substitute: boolean) => React.ReactNode;
  triggerToast: (msg: string) => void;
}

export const RawSqlEditor: React.FC<RawSqlEditorProps> = ({
  inputSql,
  setInputSql,
  dialect,
  rawPreRef,
  rawTextareaRef,
  onPasteClick,
  renderHighlightedSql,
  triggerToast,
}) => {
  return (
    <div className="flex-1 basis-1/2 border-r border-zinc-800 flex flex-col h-full min-w-0">
      <div className="p-3 bg-zinc-900/20 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-500 uppercase font-mono">
        <div className="flex items-center gap-1.5">
          <Terminal size={14} />
          <span>Raw Parameterized SQL Input</span>
        </div>
        <div className="flex items-center gap-3 normal-case text-zinc-400">
          <button
            onClick={onPasteClick}
            className="hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
          >
            <Clipboard size={14} />
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
            inputSql
              ? "text-transparent caret-zinc-100 selection:bg-blue-600/30"
              : "text-zinc-100"
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
  );
};
