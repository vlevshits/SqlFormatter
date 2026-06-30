import { describe, it, expect } from "vitest";
import {
  parseMssqlExecutesql,
  substituteMssqlParameters,
  parseMssqlDeclarations,
  parsePostgresQuery,
  substitutePostgresParameters,
  formatAndSubstituteQuery
} from "./sqlParser";

describe("MS SQL sp_executesql Parser & Substituter", () => {
  it("should extract template, declarations, and values correctly", () => {
    const input = `exec sp_executesql N'SELECT * FROM users WHERE id = @p1 AND name = @p2', N'@p1 int, @p2 nvarchar(50)', @p1=123, @p2='John Doe'`;
    const { sqlTemplate, paramDeclarations, paramValues } = parseMssqlExecutesql(input);

    expect(sqlTemplate).toBe("SELECT * FROM users WHERE id = @p1 AND name = @p2");
    expect(paramDeclarations).toBe("@p1 int, @p2 nvarchar(50)");
    expect(paramValues).toEqual({
      "@p1": "123",
      "@p2": "'John Doe'"
    });
  });

  it("should handle escaped single quotes inside the SQL template and values", () => {
    const input = `exec sp_executesql N'SELECT * FROM logs WHERE msg = ''it''''s fine'' AND type = @p1', N'@p1 varchar(10)', @p1='error'`;
    const { sqlTemplate, paramValues } = parseMssqlExecutesql(input);

    expect(sqlTemplate).toBe("SELECT * FROM logs WHERE msg = 'it''s fine' AND type = @p1");
    expect(paramValues).toEqual({
      "@p1": "'error'"
    });
  });

  it("should parse parameter declarations correctly", () => {
    const decls = "@p1 bit, @p2 nvarchar(4000), @p3 decimal(10,2)";
    const parsed = parseMssqlDeclarations(decls);
    expect(parsed).toEqual({
      "@p1": "bit",
      "@p2": "nvarchar(4000)",
      "@p3": "decimal(10,2)"
    });
  });

  it("should substitute parameters safely without affecting comments or strings", () => {
    const template = `SELECT @p1 AS val, '-- @p1 in string' AS str, /* @p1 in comment */ @p2 AS other FROM t WHERE type = @p1`;
    const assignments = {
      "@p1": "1",
      "@p2": "'Hello'"
    };
    const result = substituteMssqlParameters(template, assignments);
    expect(result).toBe(`SELECT 1 AS val, '-- @p1 in string' AS str, /* @p1 in comment */ 'Hello' AS other FROM t WHERE type = 1`);
  });

  it("should handle case-insensitivity during substitution", () => {
    const template = `SELECT @p1, @P1, @p2`;
    const assignments = {
      "@p1": "100",
      "@P2": "'abc'"
    };
    const result = substituteMssqlParameters(template, assignments);
    expect(result).toBe(`SELECT 100, 100, 'abc'`);
  });
});

describe("PostgreSQL Parameter Parser & Substituter", () => {
  it("should parse Postgres parameterized logs correctly", () => {
    const input = `SELECT * FROM users WHERE id = $1 AND email = $2
-- Parameters: $1 = 123, $2 = 'alice@example.com'`;
    const { sqlTemplate, paramValues } = parsePostgresQuery(input);

    expect(sqlTemplate).toBe("SELECT * FROM users WHERE id = $1 AND email = $2");
    expect(paramValues).toEqual({
      "$1": "123",
      "$2": "'alice@example.com'"
    });
  });

  it("should substitute Postgres parameters safely", () => {
    const template = `SELECT $1 AS id, 'value of $1' AS description, $2 AS name`;
    const assignments = {
      "$1": "456",
      "$2": "'Bob'"
    };
    const result = substitutePostgresParameters(template, assignments);
    expect(result).toBe(`SELECT 456 AS id, 'value of $1' AS description, 'Bob' AS name`);
  });

  it("should respect dollar-quoted strings in Postgres", () => {
    const template = `SELECT $1, $$some $1 text$$ AS dollar_str, $2`;
    const assignments = {
      "$1": "1",
      "$2": "2"
    };
    const result = substitutePostgresParameters(template, assignments);
    expect(result).toBe(`SELECT 1, $$some $1 text$$ AS dollar_str, 2`);
  });
});

describe("Full E2E formatAndSubstituteQuery", () => {
  it("should parse and format the user provided MS SQL executesql example query", () => {
    const source = `exec sp_executesql N' SELECT   invoice.id as [id], invoice.version as [version]  FROM InvoiceDocument as newinvoiceentity  WHERE invoice.balanceoutstanding > @p8 AND invoice.id IN (@p9L1,@p9L2) ',N'@p8 decimal(1,0),@p9L1 uniqueidentifier,@p9L2 uniqueidentifier',@p8=0,@p9L1='5F6A667C-327F-462B-ABAF-B475010E8B07',@p9L2='AFC04D3C-A943-42AA-B7B5-B475010E8B03'`;

    const result = formatAndSubstituteQuery(source, "mssql", {
      tabWidth: 2,
      keywordCase: "upper",
      logicalOperatorNewline: "before"
    });

    expect(result.success).toBe(true);
    expect(result.parameters).toHaveLength(3);
    expect(result.formattedSql).toContain("invoice.balanceoutstanding > 0");
    expect(result.formattedSql).toContain("'5F6A667C-327F-462B-ABAF-B475010E8B07'");
    expect(result.formattedSql).toContain("'AFC04D3C-A943-42AA-B7B5-B475010E8B03'");
  });
});
