"use client";

import { useState } from "react";
import { FileNode } from "@/types";
import { FaFolder, FaFolderOpen, FaFile, FaFileImage, FaChevronRight, FaChevronDown, FaEllipsisV } from "react-icons/fa";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
function isImage(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXT.includes(ext);
}

export default function FileTree({
  nodes,
  activePath,
  onSelectFile,
  onAction,
  depth = 0,
}: {
  nodes: FileNode[];
  activePath?: string;
  onSelectFile: (path: string) => void;
  onAction?: (node: FileNode) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          activePath={activePath}
          onSelectFile={onSelectFile}
          onAction={onAction}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  activePath,
  onSelectFile,
  onAction,
  depth,
}: {
  node: FileNode;
  activePath?: string;
  onSelectFile: (path: string) => void;
  onAction?: (node: FileNode) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);

  const actionButton = onAction ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAction(node);
      }}
      className="shrink-0 p-1.5 -mr-1 text-gray-500 hover:text-gray-200 active:text-gray-100"
      title="Opsi"
    >
      <FaEllipsisV size={11} />
    </button>
  ) : null;

  if (node.type === "folder") {
    return (
      <div>
        <div
          className="w-full flex items-center gap-1.5 py-1.5 px-2 text-sm hover:bg-white/5 rounded-md active:bg-white/10"
        >
          <button
            onClick={() => setOpen(!open)}
            className="flex-1 flex items-center gap-1.5 min-w-0"
            style={{ paddingLeft: `${depth * 14}px` }}
          >
            {open ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />}
            {open ? <FaFolderOpen size={13} className="text-accent" /> : <FaFolder size={13} className="text-accent" />}
            <span className="truncate">{node.name}</span>
          </button>
          {actionButton}
        </div>
        {open && node.children && (
          <FileTree
            nodes={node.children}
            activePath={activePath}
            onSelectFile={onSelectFile}
            onAction={onAction}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  const active = activePath === node.path;

  return (
    <div
      className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md ${
        active ? "bg-accent/20 text-accent" : "hover:bg-white/5 active:bg-white/10"
      }`}
    >
      <button
        onClick={() => onSelectFile(node.path)}
        className="flex-1 flex items-center gap-1.5 min-w-0 truncate"
        style={{ paddingLeft: `${depth * 14 + 14}px` }}
      >
        {isImage(node.name) ? (
          <FaFileImage size={11} className="shrink-0 text-purple-400" />
        ) : (
          <FaFile size={11} className="shrink-0 text-gray-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {actionButton}
    </div>
  );
}
