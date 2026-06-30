import {
  FileText,
  History,
  Download,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { ParseResult } from "../utils/sqlParser";

interface FormattedSqlViewerProps {
  parseResult: ParseResult | null;
  renderHighlightedSql: (sql: string, substitute: boolean) => React.ReactNode;
  onSaveToHistory: () => void;
  onDownload: () => void;
  onCopy: () => void;
  copySuccess: boolean;
  dialect: "mssql" | "postgres";
  stats: {
    timeMs: number;
    charReduction: number;
    paramCount: number;
  };
}

export const FormattedSqlViewer: React.FC<FormattedSqlViewerProps> = ({
  parseResult,
  renderHighlightedSql,
  onSaveToHistory,
  onDownload,
  onCopy,
  copySuccess,
  dialect,
  stats,
}) => {
  return (
    <div className="flex-1 basis-1/2 flex flex-col min-w-0 min-h-0 bg-zinc-900/10">
      <div className="p-3 bg-zinc-900/20 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-500 uppercase font-mono">
        <div className="flex items-center gap-1.5">
          <FileText size={14} />
          <span>Formatted Query Output</span>
        </div>
        {parseResult && parseResult.success && (
          <div className="flex items-center gap-3.5 normal-case text-zinc-400">
            {/* Save */}
            <button
              onClick={onSaveToHistory}
              className="hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Save to history"
            >
              <History size={12} />
              <span>Save</span>
            </button>

            {/* Download */}
            <button
              onClick={onDownload}
              className="hover:text-zinc-200 flex items-center gap-1 cursor-pointer border-l border-zinc-800 pl-3.5 transition-colors"
              title="Download SQL File"
            >
              <Download size={12} />
              <span>Download</span>
            </button>

            {/* Copy */}
            <button
              onClick={onCopy}
              className={`flex items-center gap-1 cursor-pointer border-l border-zinc-800 pl-3.5 transition-colors ${
                copySuccess ? "text-emerald-400 hover:text-emerald-300 font-semibold" : "hover:text-zinc-200"
              }`}
              title="Copy to clipboard"
            >
              {copySuccess ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
              <span>{copySuccess ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-auto bg-zinc-950 font-mono text-xs select-text whitespace-pre leading-relaxed border-0 relative">
        {parseResult ? (
          parseResult.success ? (
            <code className="block select-text font-mono">
              {renderHighlightedSql(
                parseResult.formattedTemplateSql || parseResult.formattedSql,
                true
              )}
            </code>
          ) : (
            <div className="text-red-400 font-mono p-2 border border-red-900/50 bg-red-950/20 rounded">
              <span className="font-semibold text-xs block mb-1">Parsing Error:</span>
              <span className="text-[11px] block">{parseResult.error}</span>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 text-xs font-sans pointer-events-none">
            <Loader2 size={32} className="opacity-40 animate-spin mb-2" />
            <span>Waiting for query input...</span>
          </div>
        )}
      </div>

      {/* Output stats footer */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/20 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-4">
          <span>
            Dialect:{" "}
            <strong className="text-zinc-400">
              {dialect === "mssql" ? "MS SQL" : "Postgres"}
            </strong>
          </span>
          {parseResult?.success && (
            <span>
              Substituted:{" "}
              <strong className="text-zinc-400">{stats.paramCount} params</strong>
            </span>
          )}
        </div>
        {parseResult?.success && (
          <span>
            Time: <strong className="text-zinc-400">{stats.timeMs}ms</strong>
          </span>
        )}
      </div>
    </div>
  );
};
