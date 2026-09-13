"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useRef, useCallback, useEffect, useState } from "react";

function langFromPath(path: string) {
  const name = path.split("/").pop() || path;
  const lower = name.toLowerCase();

  // Banyak file config penting gak punya ekstensi biasa (Dockerfile) atau
  // namanya sendiri YANG jadi ekstensinya (.env, .env.production, dst) —
  // kalau cuma ngandelin path.split(".").pop(), file-file ini kebaca
  // "plaintext" polos tanpa syntax highlighting sama sekali. Cek nama file
  // dulu sebelum fallback ke ekstensi.
  const FILENAME_LANG: Record<string, string> = {
    dockerfile: "dockerfile",
    makefile: "shell",
    ".gitignore": "plaintext",
    ".dockerignore": "plaintext",
    ".npmrc": "ini",
    ".editorconfig": "ini",
    ".prettierrc": "json",
    ".eslintrc": "json",
  };
  if (FILENAME_LANG[lower]) return FILENAME_LANG[lower];
  // .env, .env.local, .env.production, dll -> format KEY=VALUE, highlighting "ini" paling deket
  if (lower.startsWith(".env")) return "ini";

  const ext = lower.split(".").pop();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", json: "json", html: "html", css: "css", scss: "scss",
    md: "markdown", yml: "yaml", yaml: "yaml", java: "java", go: "go",
    rb: "ruby", php: "php", c: "c", cpp: "cpp", cs: "csharp", sh: "shell",
    rs: "rust", sql: "sql", xml: "xml", kt: "kotlin", swift: "swift",
    ini: "ini", toml: "ini", conf: "ini", cfg: "ini", properties: "ini",
    bat: "bat", ps1: "powershell", lua: "lua", r: "r", pl: "perl",
    dart: "dart", scala: "scala", groovy: "java", vue: "html",
  };
  return map[ext || ""] || "plaintext";
}

export default function CodeEditor({
  path,
  value,
  onChange,
  aiEnabled = true,
  readOnly = false,
}: {
  path: string;
  value: string;
  onChange: (val: string) => void;
  aiEnabled?: boolean;
  readOnly?: boolean;
}) {
  const providerRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const [monacoTimedOut, setMonacoTimedOut] = useState(false);

  // Kalau Monaco Editor gak berhasil ke-mount dalam 12 detik (biasanya
  // gara-gara script-nya ke-block sesuatu di jaringan — firewall kantor,
  // ad-blocker agresif, dll — BUKAN soal sinyal HP), tampilin pesan jelas
  // + saran, daripada diem loading selamanya tanpa penjelasan.
  useEffect(() => {
    mountedRef.current = false;
    setMonacoTimedOut(false);
    const timer = setTimeout(() => {
      if (!mountedRef.current) setMonacoTimedOut(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [path]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      mountedRef.current = true;
      setMonacoTimedOut(false);

      // AI ghost-text suggestion (mirip Copilot) — muncul otomatis, tekan Tab untuk terima
      if (providerRef.current) providerRef.current.dispose();

      if (!aiEnabled) return;

      providerRef.current = monaco.languages.registerInlineCompletionsProvider(
        { pattern: "**" },
        {
          async provideInlineCompletions(model, position) {
            const codeBefore = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });
            const codeAfter = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: model.getLineCount(),
              endColumn: model.getLineMaxColumn(model.getLineCount()),
            });

            // jangan minta saran kalau baris kosong / baru ganti file (biar hemat kuota gratis)
            if (codeBefore.trim().length < 3) return { items: [] };

            try {
              const res = await fetch("/api/ai/suggest", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  filename: path,
                  language: langFromPath(path),
                  codeBefore,
                  codeAfter,
                }),
              });
              if (!res.ok) return { items: [] };
              const data = await res.json();
              if (!data.suggestion) return { items: [] };

              return {
                items: [
                  {
                    insertText: data.suggestion,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                  },
                ],
              };
            } catch {
              return { items: [] };
            }
          },
          freeInlineCompletions() {},
        }
      );
    },
    [path, aiEnabled]
  );

  return (
    <div className="editor-wrapper w-full">
      {monacoTimedOut ? (
        <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#1e1e1e]">
          <p className="text-sm text-gray-300">
            Editor gagal dimuat setelah 12 detik.
          </p>
          <p className="text-xs text-gray-500 max-w-sm">
            Ini biasanya bukan soal sinyal HP, tapi ada sesuatu di jaringan
            kamu (firewall, VPN, ad-blocker, atau DNS filter) yang
            memblokir script editor dari CDN. Coba matikan sebentar, ganti
            jaringan (misal dari WiFi ke data seluler), atau reload halaman
            ini.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-accent underline"
          >
            Reload Halaman
          </button>
        </div>
      ) : (
        <Editor
          key={path}
          path={path}
          defaultLanguage={langFromPath(path)}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          theme="vs-dark"
          loading={
            <div className="text-sm text-gray-500">Memuat editor...</div>
          }
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            inlineSuggest: { enabled: true },
            tabSize: 2,
            padding: { top: 12 },
            readOnly,
          }}
        />
      )}
    </div>
  );
}
