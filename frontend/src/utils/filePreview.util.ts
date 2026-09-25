export const textPreviewExtensions = new Set([
  "txt",
  "text",
  "md",
  "markdown",
  "log",
  "json",
  "jsonl",
  "ndjson",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "svg",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "py",
  "java",
  "go",
  "rs",
  "c",
  "h",
  "cc",
  "cpp",
  "cxx",
  "hpp",
  "cs",
  "kt",
  "kts",
  "swift",
  "rb",
  "php",
  "pl",
  "lua",
  "r",
  "sh",
  "bash",
  "zsh",
  "fish",
  "ps1",
  "bat",
  "cmd",
  "sql",
  "graphql",
  "gql",
  "csv",
  "tsv",
  "ini",
  "toml",
  "env",
  "properties",
  "conf",
  "config",
  "diff",
  "patch",
  "mk",
  "dockerfile",
  "makefile",
  "gradle",
  "dart",
  "ex",
  "exs",
  "erl",
  "hs",
]);

export const isTextPreviewableFile = (
  name?: string | null,
  mimeType?: string | null,
) => {
  const basename = (name || "").split(/[\\/]/).pop()?.toLowerCase() || "";
  const extension = basename.split(".").pop() || "";
  const mime = (mimeType || "").toLowerCase();
  return (
    textPreviewExtensions.has(extension) ||
    basename === "dockerfile" ||
    basename === "makefile" ||
    basename.startsWith(".env") ||
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "application/xml" ||
    mime.endsWith("+xml") ||
    mime.includes("yaml")
  );
};
