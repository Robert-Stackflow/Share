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

export const TEXT_PREVIEW_LIMIT = 1024 * 1024;
export const IMAGE_PREVIEW_LIMIT = 20 * 1024 * 1024;
export const PDF_PREVIEW_LIMIT = 25 * 1024 * 1024;
export const MEDIA_PREVIEW_LIMIT = 50 * 1024 * 1024;

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

export const previewLimitForFile = (
  name?: string | null,
  mimeType?: string | null,
): number | undefined => {
  const mime = (mimeType || "").toLowerCase();
  if (mime === "application/pdf" || name?.toLowerCase().endsWith(".pdf"))
    return PDF_PREVIEW_LIMIT;
  if (mime.startsWith("image/") && mime !== "image/svg+xml")
    return IMAGE_PREVIEW_LIMIT;
  if (mime.startsWith("audio/") || mime.startsWith("video/"))
    return MEDIA_PREVIEW_LIMIT;
  if (isTextPreviewableFile(name, mimeType)) return TEXT_PREVIEW_LIMIT;
  return undefined;
};

export const exceedsPreviewLimit = (
  size: string | number | null | undefined,
  limit: number,
) => Number(size || 0) > limit;
