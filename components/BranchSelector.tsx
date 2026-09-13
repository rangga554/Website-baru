"use client";

import { useState } from "react";
import { Branch } from "@/types";
import { FaCodeBranch, FaPlus } from "react-icons/fa";

export default function BranchSelector({
  branches,
  current,
  onChange,
  onCreate,
}: {
  branches: Branch[];
  current: string;
  onChange: (b: string) => void;
  onCreate: (newName: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex items-center gap-1.5">
      <FaCodeBranch size={12} className="text-gray-400 shrink-0" />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="bg-panel border border-border rounded-lg text-xs sm:text-sm py-1.5 px-2 outline-none max-w-[110px] sm:max-w-[180px] truncate"
      >
        {branches.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => setShowNew(true)}
        title="Buat branch baru"
        className="bg-panel border border-border rounded-lg p-1.5 active:scale-95"
      >
        <FaPlus size={11} />
      </button>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-semibold mb-3 text-sm">Buat Branch Baru</h3>
            <p className="text-xs text-gray-400 mb-2">Dari branch: {current}</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="nama-branch-baru"
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!name.trim()) return;
                  onCreate(name.trim());
                  setName("");
                  setShowNew(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium"
              >
                Buat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
