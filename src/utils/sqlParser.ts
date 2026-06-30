import { format } from "sql-formatter";

export interface Parameter {
  name: string;
  type?: string;
  value: string;
}

export interface ParseResult {
  success: boolean;
  rawSql: string;
  substitutedSql: string;
  formattedSql: string;
  dialect: "mssql" | "postgres";
  parameters: Parameter[];
  error?: string;
}

export interface FormatConfig {
  tabWidth: number;
  keywordCase: "upper" | "lower" | "preserve";
  logicalOperatorNewline: "before" | "after";
}

/**
 * Parses a single-quoted SQL string literal, handling escaped single quotes ('').
 * Returns the unescaped content and the closing single quote's index.
 */
export function parseSqlStringLiteral(input: string, startIndex: number): { value: string; endIndex: number } {
  let index = startIndex + 1;
  let value = "";
  while (index < input.length) {
    if (input[index] === "'") {
      if (index + 1 < input.length && input[index + 1] === "'") {
        value += "'";
        index += 2;
      } else {
        return { value, endIndex: index };
      }
    } else {
      value += input[index];
      index++;
    }
  }
  throw new Error("Unterminated string literal starting at position " + startIndex);
}

/**
 * Parses MS SQL sp_executesql query string.
 * Format: exec sp_executesql N'<SQL_TEMPLATE>', N'<PARAMS>', @p1=val1, @p2=val2, ...
 */
export function parseMssqlExecutesql(input: string): {
  sqlTemplate: string;
  paramDeclarations: string;
  paramValues: Record<string, string>;
} {
  // Find "sp_executesql" case insensitively
  const match = input.match(/sp_executesql/i);
  if (!match || match.index === undefined) {
    throw new Error("Could not find 'sp_executesql' in the input string.");
  }

  let index = match.index + "sp_executesql".length;

  // 1. Extract SQL Template (the first N-string or standard string)
  while (index < input.length && input[index] !== "'") {
    index++;
  }
  if (index >= input.length) {
    throw new Error("Could not find the SQL template string in sp_executesql.");
  }

  const sqlStrResult = parseSqlStringLiteral(input, index);
  const sqlTemplate = sqlStrResult.value;
  index = sqlStrResult.endIndex + 1;

  // 2. Extract Parameter Declarations (the second N-string or standard string)
  while (index < input.length && input[index] !== "'") {
    index++;
  }
  
  let paramDeclarations = "";
  if (index < input.length) {
    const declsResult = parseSqlStringLiteral(input, index);
    paramDeclarations = declsResult.value;
    index = declsResult.endIndex + 1;
  }

  // 3. Extract parameter values (@p1=val1, @p2=val2, ...)
  const paramValues: Record<string, string> = {};
  while (index < input.length) {
    // Skip whitespace and commas
    if (/\s|,/.test(input[index])) {
      index++;
      continue;
    }

    // Look for parameter name starting with @
    if (input[index] === "@") {
      let name = "@";
      index++;
      while (index < input.length && /[a-zA-Z0-9_]/.test(input[index])) {
        name += input[index];
        index++;
      }

      // Find '='
      while (index < input.length && /\s/.test(input[index])) {
        index++;
      }
      if (input[index] !== "=") {
        index++;
        continue;
      }
      index++; // skip '='

      while (index < input.length && /\s/.test(input[index])) {
        index++;
      }

      // Parse the value
      let value = "";
      if (input[index] === "'") {
        // String literal value
        const valResult = parseSqlStringLiteral(input, index);
        // We preserve it as a quoted literal for substitution
        value = `'${valResult.value.replace(/'/g, "''")}'`;
        index = valResult.endIndex + 1;
      } else if (input[index] === "N" && input[index + 1] === "'") {
        // Unicode string literal value
        const valResult = parseSqlStringLiteral(input, index + 1);
        value = `'${valResult.value.replace(/'/g, "''")}'`;
        index = valResult.endIndex + 1;
      } else {
        // Numeric, NULL or boolean value (read until next comma or next parameter declaration)
        const valStart = index;
        while (index < input.length) {
          // Look ahead to check if we are starting a new parameter (e.g. ,@p)
          const lookAhead = input.substring(index, index + 5);
          if (input[index] === "," || /^\s+@/.test(lookAhead) || /^,\s*@/.test(lookAhead)) {
            break;
          }
          index++;
        }
        value = input.substring(valStart, index).trim();
      }

      paramValues[name] = value;
    } else {
      index++;
    }
  }

  return { sqlTemplate, paramDeclarations, paramValues };
}

/**
 * Scans the MS SQL template and substitutes parameters safely, respecting comments and strings.
 */
export function substituteMssqlParameters(sqlTemplate: string, assignments: Record<string, string>): string {
  // Normalize assignments keys to lowercase for case-insensitive matching
  const normAssignments: Record<string, string> = {};
  for (const [k, v] of Object.entries(assignments)) {
    normAssignments[k.toLowerCase()] = v;
  }

  let result = "";
  let index = 0;
  while (index < sqlTemplate.length) {
    const char = sqlTemplate[index];

    // 1. Single line comment
    if (char === "-" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "-") {
      result += "--";
      index += 2;
      while (index < sqlTemplate.length && sqlTemplate[index] !== "\n") {
        result += sqlTemplate[index];
        index++;
      }
      continue;
    }

    // 2. Block comment
    if (char === "/" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "*") {
      result += "/*";
      index += 2;
      while (index < sqlTemplate.length) {
        if (sqlTemplate[index] === "*" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "/") {
          result += "*/";
          index += 2;
          break;
        }
        result += sqlTemplate[index];
        index++;
      }
      continue;
    }

    // 3. String literals (standard and unicode)
    if (char === "'") {
      try {
        const { value, endIndex } = parseSqlStringLiteral(sqlTemplate, index);
        result += `'${value.replace(/'/g, "''")}'`;
        index = endIndex + 1;
      } catch {
        result += char;
        index++;
      }
      continue;
    }
    if (char === "N" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "'") {
      try {
        const { value, endIndex } = parseSqlStringLiteral(sqlTemplate, index + 1);
        result += `N'${value.replace(/'/g, "''")}'`;
        index = endIndex + 1;
      } catch {
        result += char;
        index++;
      }
      continue;
    }

    // 4. Parameter starting with @
    if (char === "@") {
      let name = "@";
      let nameIndex = index + 1;
      while (nameIndex < sqlTemplate.length && /[a-zA-Z0-9_]/.test(sqlTemplate[nameIndex])) {
        name += sqlTemplate[nameIndex];
        nameIndex++;
      }

      const lowerName = name.toLowerCase();
      if (name !== "@" && lowerName in normAssignments) {
        result += normAssignments[lowerName];
        index = nameIndex;
      } else {
        result += char;
        index++;
      }
      continue;
    }

    // 5. Normal character
    result += char;
    index++;
  }

  return result;
}

/**
 * Parses parameter declarations like "@p1 bit, @p2 nvarchar(4000)"
 */
export function parseMssqlDeclarations(decls: string): Record<string, string> {
  const types: Record<string, string> = {};
  if (!decls) return types;

  // Split by comma, but be careful not to split inside parenthesized types like decimal(10,2)
  let current = "";
  let parenDepth = 0;
  const parts: string[] = [];

  for (let i = 0; i < decls.length; i++) {
    const char = decls[i];
    if (char === "(") parenDepth++;
    if (char === ")") parenDepth--;
    
    if (char === "," && parenDepth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }

  for (const part of parts) {
    const trimmed = part.trim();
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex > 0) {
      const name = trimmed.substring(0, spaceIndex).trim();
      const type = trimmed.substring(spaceIndex + 1).trim();
      types[name] = type;
    } else if (trimmed) {
      types[trimmed] = "";
    }
  }

  return types;
}

/**
 * Parses PostgreSQL logs or parameterized query format.
 * Expects parameters defined on lines containing "parameters:" or "-- parameters".
 */
export function parsePostgresQuery(input: string): {
  sqlTemplate: string;
  paramValues: Record<string, string>;
} {
  const lines = input.split("\n");
  const sqlLines: string[] = [];
  let paramLine = "";

  for (const line of lines) {
    if (/parameters:/i.test(line) || /^\s*--\s*parameters/i.test(line)) {
      paramLine = line;
    } else {
      // Clean prefix if it is from Postgres logs (e.g. "LOG: execute <unnamed>: SELECT ...")
      const execMatch = line.match(/(?:execute\s+<[^>]+>|statement):\s*(.*)/i);
      if (execMatch) {
        sqlLines.push(execMatch[1]);
      } else {
        sqlLines.push(line);
      }
    }
  }

  const paramValues: Record<string, string> = {};
  if (paramLine) {
    let index = paramLine.indexOf("$");
    while (index !== -1 && index < paramLine.length) {
      // Read $N
      let name = "$";
      let nextIndex = index + 1;
      while (nextIndex < paramLine.length && /[0-9]/.test(paramLine[nextIndex])) {
        name += paramLine[nextIndex];
        nextIndex++;
      }

      // Find '='
      while (nextIndex < paramLine.length && /\s/.test(paramLine[nextIndex])) {
        nextIndex++;
      }

      if (paramLine[nextIndex] === "=") {
        nextIndex++; // skip '='
        while (nextIndex < paramLine.length && /\s/.test(paramLine[nextIndex])) {
          nextIndex++;
        }

        // Parse value
        let value = "";
        if (paramLine[nextIndex] === "'") {
          const valResult = parseSqlStringLiteral(paramLine, nextIndex);
          value = `'${valResult.value.replace(/'/g, "''")}'`;
          nextIndex = valResult.endIndex + 1;
        } else {
          const valStart = nextIndex;
          while (nextIndex < paramLine.length) {
            // Stop at comma or next parameter definition (e.g. , $2)
            const lookAhead = paramLine.substring(nextIndex, nextIndex + 5);
            if (paramLine[nextIndex] === "," || /^\s+\$/.test(lookAhead) || /^,\s*\$/.test(lookAhead)) {
              break;
            }
            nextIndex++;
          }
          value = paramLine.substring(valStart, nextIndex).trim();
        }
        paramValues[name] = value;
      }
      index = paramLine.indexOf("$", nextIndex);
    }
  }

  let sqlTemplate = sqlLines.join("\n").trim();

  // Strip trailing parameter comment lines from SQL
  if (sqlTemplate.includes("--")) {
    const parts = sqlTemplate.split("\n");
    while (parts.length > 0 && /^\s*--\s*(parameters|\$\d+)/i.test(parts[parts.length - 1])) {
      parts.pop();
    }
    sqlTemplate = parts.join("\n").trim();
  }

  return { sqlTemplate, paramValues };
}

/**
 * Scans the PostgreSQL template and substitutes parameters safely, respecting comments and strings.
 */
export function substitutePostgresParameters(sqlTemplate: string, assignments: Record<string, string>): string {
  let result = "";
  let index = 0;
  while (index < sqlTemplate.length) {
    const char = sqlTemplate[index];

    // 1. Single line comment
    if (char === "-" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "-") {
      result += "--";
      index += 2;
      while (index < sqlTemplate.length && sqlTemplate[index] !== "\n") {
        result += sqlTemplate[index];
        index++;
      }
      continue;
    }

    // 2. Block comment
    if (char === "/" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "*") {
      result += "/*";
      index += 2;
      while (index < sqlTemplate.length) {
        if (sqlTemplate[index] === "*" && index + 1 < sqlTemplate.length && sqlTemplate[index + 1] === "/") {
          result += "*/";
          index += 2;
          break;
        }
        result += sqlTemplate[index];
        index++;
      }
      continue;
    }

    // 3. Single-quoted strings
    if (char === "'") {
      try {
        const { value, endIndex } = parseSqlStringLiteral(sqlTemplate, index);
        result += `'${value.replace(/'/g, "''")}'`;
        index = endIndex + 1;
      } catch {
        result += char;
        index++;
      }
      continue;
    }

    // 4. Dollar-quoted string literals or parameters
    if (char === "$") {
      // Check if it's a parameter placeholder like $1
      if (index + 1 < sqlTemplate.length && /[0-9]/.test(sqlTemplate[index + 1])) {
        let name = "$";
        let nameIndex = index + 1;
        while (nameIndex < sqlTemplate.length && /[0-9]/.test(sqlTemplate[nameIndex])) {
          name += sqlTemplate[nameIndex];
          nameIndex++;
        }

        if (name in assignments) {
          result += assignments[name];
          index = nameIndex;
        } else {
          result += char;
          index++;
        }
        continue;
      } else {
        // Check for dollar-quoted string starting, e.g. $$ or $tag$
        let tagEnd = index + 1;
        while (tagEnd < sqlTemplate.length && sqlTemplate[tagEnd] !== "$" && /[a-zA-Z0-9_]/.test(sqlTemplate[tagEnd])) {
          tagEnd++;
        }

        if (tagEnd < sqlTemplate.length && sqlTemplate[tagEnd] === "$") {
          const tag = sqlTemplate.substring(index, tagEnd + 1);
          result += tag;
          index = tagEnd + 1;

          // Find matching closing tag
          const closeIndex = sqlTemplate.indexOf(tag, index);
          if (closeIndex !== -1) {
            result += sqlTemplate.substring(index, closeIndex) + tag;
            index = closeIndex + tag.length;
          }
          continue;
        }
      }
    }

    // 5. Normal character
    result += char;
    index++;
  }

  return result;
}

/**
 * Main function to parse, substitute, and format parameterized SQL queries.
 */
export function formatAndSubstituteQuery(
  input: string,
  dialect: "mssql" | "postgres",
  config: FormatConfig
): ParseResult {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return {
      success: false,
      rawSql: "",
      substitutedSql: "",
      formattedSql: "",
      dialect,
      parameters: [],
      error: "Input query is empty."
    };
  }

  try {
    let sqlTemplate = "";
    let substitutedSql = "";
    let parameters: Parameter[] = [];

    if (dialect === "mssql") {
      // Check if it looks like sp_executesql
      if (/sp_executesql/i.test(trimmedInput)) {
        const { sqlTemplate: template, paramDeclarations, paramValues } = parseMssqlExecutesql(trimmedInput);
        sqlTemplate = template;
        
        // Parse declarations to get types
        const types = parseMssqlDeclarations(paramDeclarations);
        
        // Build parameters list
        parameters = Object.keys(paramValues).map((name) => ({
          name,
          type: types[name] || undefined,
          value: paramValues[name]
        }));

        // Substitute
        substitutedSql = substituteMssqlParameters(sqlTemplate, paramValues);
      } else {
        // If not executesql, format raw
        sqlTemplate = trimmedInput;
        substitutedSql = trimmedInput;
      }
    } else {
      // Postgres parsing
      const { sqlTemplate: template, paramValues } = parsePostgresQuery(trimmedInput);
      sqlTemplate = template;

      parameters = Object.keys(paramValues).map((name) => ({
        name,
        value: paramValues[name]
      }));

      // Substitute
      substitutedSql = substitutePostgresParameters(sqlTemplate, paramValues);
    }

    // Format the substituted SQL using sql-formatter
    const formatterLanguage = dialect === "mssql" ? "tsql" : "postgresql";
    
    // We map custom format config options to sql-formatter config options
    const formattedSql = format(substitutedSql, {
      language: formatterLanguage,
      tabWidth: config.tabWidth,
      keywordCase: config.keywordCase,
      logicalOperatorNewline: config.logicalOperatorNewline
    });

    return {
      success: true,
      rawSql: sqlTemplate,
      substitutedSql,
      formattedSql,
      dialect,
      parameters
    };
  } catch (err: any) {
    return {
      success: false,
      rawSql: input,
      substitutedSql: "",
      formattedSql: "",
      dialect,
      parameters: [],
      error: err.message || "An unknown error occurred during parsing."
    };
  }
}
