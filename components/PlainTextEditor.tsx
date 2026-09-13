"use client";

// Sengaja PAKAI <textarea> biasa, BUKAN Monaco — karena Monaco punya
// clipboard & keyboard handling sendiri yang sering bentrok sama keyboard
// bawaan HP (copy/paste jadi kaku, kadang gak nempel ke clipboard OS).
// Textarea native selalu nyambung mulus ke clipboard & keyboard bawaan,
// termasuk fitur "select all", "paste" dari menu kontekstual HP.
export default function PlainTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="editor-wrapper w-full bg-[#1e1e1e]">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        className="w-full h-full bg-transparent text-gray-200 font-mono text-[13px] leading-relaxed p-4 outline-none resize-none"
        placeholder="Mulai ngetik..."
      />
    </div>
  );
}
