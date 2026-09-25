import { Expand } from "lucide-react";
import { ActionIcon, Group, Loader, Modal, Text } from "@mantine/core";
import hljs from "highlight.js/lib/common";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import powershell from "highlight.js/lib/languages/powershell";
import dart from "highlight.js/lib/languages/dart";
import dos from "highlight.js/lib/languages/dos";
import groovy from "highlight.js/lib/languages/groovy";
import { useEffect, useMemo, useRef, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import classes from "./RoomCodePreview.module.css";

for (const [name, language] of Object.entries({
  dockerfile,
  powershell,
  dart,
  dos,
  groovy,
})) {
  hljs.registerLanguage(name, language);
}

const languageForExtension: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  diff: "diff",
  patch: "diff",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonl: "json",
  ndjson: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  java: "java",
  go: "go",
  rs: "rust",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  rb: "ruby",
  php: "php",
  pl: "perl",
  lua: "lua",
  r: "r",
  ps1: "powershell",
  bat: "dos",
  cmd: "dos",
  dart: "dart",
  graphql: "graphql",
  gql: "graphql",
  ini: "ini",
  toml: "ini",
  env: "ini",
  properties: "ini",
  conf: "ini",
  config: "ini",
  mk: "makefile",
  dockerfile: "dockerfile",
  makefile: "makefile",
  gradle: "groovy",
  csv: "plaintext",
  tsv: "plaintext",
  vue: "xml",
  svelte: "xml",
  svg: "xml",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  html: "xml",
  htm: "xml",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character,
  );

export default function RoomCodePreview({
  name,
  url,
  full = false,
}: {
  name: string;
  url: string;
  full?: boolean;
}) {
  const t = useTranslate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const language = languageForExtension[extension];

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    const previewUrl = `${url}${url.includes("?") ? "&" : "?"}preview=text`;
    fetch(previewUrl, { signal: controller.signal, credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        return response.text();
      })
      .then(setContent)
      .catch((error) => {
        if (error?.name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [visible, url]);

  const preview = useMemo(() => {
    if (content === undefined) return undefined;
    let value = content;
    let itemCount: number | undefined;
    if (extension === "json") {
      try {
        const parsed = JSON.parse(content);
        value = JSON.stringify(parsed, null, 2);
        if (parsed && typeof parsed === "object")
          itemCount = Object.keys(parsed).length;
      } catch {
        // Keep malformed JSON readable as plain source.
      }
    }
    let html = escapeHtml(value);
    if (language) {
      try {
        html = hljs.highlight(value, { language, ignoreIllegals: true }).value;
      } catch {
        // Keep escaped text when a language grammar cannot parse it.
      }
    }
    return {
      html,
      lines: value.split(/\r\n|\r|\n/).length,
      itemCount,
    };
  }, [content, extension, language]);

  return (
    <div ref={rootRef} className={classes.root}>
      {loading && !preview && (
        <Group gap="xs" className={classes.loading}>
          <Loader size="xs" />
          <Text size="xs" c="dimmed">
            {t("room.file.loadingPreview")}
          </Text>
        </Group>
      )}
      {failed && (
        <Text c="dimmed" size="sm">
          {t("room.file.previewUnavailable")}
        </Text>
      )}
      {preview && (
        <div className={`${classes.preview} ${full ? classes.full : ""}`}>
          <Group justify="space-between" className={classes.previewHeader}>
            <Group gap="xs">
              <Text size="xs" fw={650}>
                {t("room.file.preview")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("room.file.lines", { count: preview.lines })}
                {preview.itemCount !== undefined &&
                  ` · ${t("room.file.items", { count: preview.itemCount })}`}
              </Text>
            </Group>
            {!full && (
              <ActionIcon
                aria-label={t("room.file.openPreview", { name })}
                size="sm"
                variant="subtle"
                onClick={() => setOpen(true)}
              >
                <Expand size={16} />
              </ActionIcon>
            )}
          </Group>
          <pre className={classes.codeSnippet}>
            <code dangerouslySetInnerHTML={{ __html: preview.html }} />
          </pre>
          <Modal
            opened={open}
            onClose={() => setOpen(false)}
            title={name}
            size="xl"
            centered
          >
            <pre className={classes.codeExpanded}>
              <code dangerouslySetInnerHTML={{ __html: preview.html }} />
            </pre>
          </Modal>
        </div>
      )}
    </div>
  );
}
