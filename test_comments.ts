import { formatAndSubstituteQuery } from "./src/utils/sqlParser";

const query = `
-- this is a SELECT comment
SELECT * FROM [table]; -- comment containing WITH and INTO
`;

const result = formatAndSubstituteQuery(query, "mssql", {
  tabWidth: 2,
  keywordCase: "upper",
  logicalOperatorNewline: "before",
  removeComments: false
});

console.log("Formatted SQL:\n", result.formattedSql);
console.log("Template SQL:\n", result.formattedTemplateSql);
