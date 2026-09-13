"use client";

import { FaEdit, FaPencilAlt, FaTrash, FaTimes } from "react-icons/fa";

export default function FileToolbarMenu({
  path,
  onClose,
  onEdit,
  onRename,
  onDelete,
}: {
  path: string;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[996] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-panel p-2 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-400 truncate">{path}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 shrink-0 ml-2">
            <FaTimes size={14} />
          </button>
        </div>

        <button
          onClick={() => {
            onClose();
            onEdit();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-white/5 active:bg-white/10"
        >
          <FaPencilAlt className="text-accent" />
          Edit File
        </button>

        <button
          onClick={() => {
            onClose();
            onRename();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-white/5 active:bg-white/10"
        >
          <FaEdit className="text-gray-400" />
          Rename
        </button>

        <button
          onClick={() => {
            onClose();
            onDelete();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-white/5 active:bg-white/10 text-red-400"
        >
          <FaTrash />
          Hapus
        </button>
      </div>
    </div>
  );
}
