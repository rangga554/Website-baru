"use client";

import { useEffect, useState } from "react";
import { FaFlag, FaPowerOff, FaClock, FaCalendarAlt, FaTrash, FaBolt } from "react-icons/fa";
import { formatEventRemaining, type EventSettings } from "@/lib/eventShared";

// Buat <input type="datetime-local"> (butuh format "YYYY-MM-DDTHH:mm", lokal
// -- bukan ISO UTC kayak yang disimpan di server).
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function EventPanel() {
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [hutNumber, setHutNumber] = useState("81");
  const [durationHours, setDurationHours] = useState(""); // kosong = tanpa batas waktu
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/owner/event");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat pengaturan event");
      setSettings(data);
      setHutNumber(String(data.hutNumber));
      setScheduleStart(toLocalInputValue(data.scheduledStartAt));
      setScheduleEnd(toLocalInputValue(data.scheduledEndAt));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send(body: Record<string, any>, successMsg: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/owner/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal update event");
      setSettings(data);
      setNotice(successMsg);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleActivateNow() {
    const hours = durationHours.trim() ? Number(durationHours) : null;
    send(
      {
        hutNumber: Number(hutNumber),
        activateNow: true,
        durationHours: hours,
      },
      "Event diaktifkan! Notif terkirim ke semua user. 🎉"
    );
  }

  function handleStopNow() {
    send({ deactivateNow: true }, "Event dimatikan.");
  }

  function handleSaveHutNumber() {
    send({ hutNumber: Number(hutNumber) }, "HUT ke berapa berhasil diubah.");
  }

  function handleSaveDuration() {
    const hours = durationHours.trim() ? Number(durationHours) : null;
    send({ durationHours: hours }, "Durasi event diperbarui.");
  }

  function handleSaveSchedule() {
    send(
      {
        scheduledStartAt: fromLocalInputValue(scheduleStart),
        scheduledEndAt: fromLocalInputValue(scheduleEnd),
      },
      "Jadwal otomatis disimpan."
    );
  }

  function handleClearSchedule() {
    setScheduleStart("");
    setScheduleEnd("");
    send({ clearSchedule: true }, "Jadwal otomatis dihapus.");
  }

  if (error && !settings) {
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          {error.includes("event_settings") || error.includes("Gagal ambil") ? (
            <p className="mt-1 text-xs text-red-300/70">
              Event Panel butuh tabel <code>event_settings</code> (lihat supabase_schema.txt
              bagian 10).
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-sm text-gray-400">Memuat Event Panel...</p>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
        <FaFlag className="text-red-400" /> Event Kemerdekaan Indonesia
      </h2>

      {/* Status sekarang */}
      <div
        className={`rounded-xl border p-4 mb-3 ${
          settings.active
            ? "border-red-500/40 bg-red-500/10"
            : "border-border bg-panel"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              {settings.active ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  Event AKTIF — HUT RI ke-{settings.hutNumber}
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-600" />
                  Event nonaktif
                </>
              )}
            </p>
            {settings.active && settings.endsAt && (
              <p className="text-xs text-gray-400 mt-1">
                Sisa waktu: {formatEventRemaining(settings.endsAt)} (auto-mati)
              </p>
            )}
            {settings.active && !settings.endsAt && (
              <p className="text-xs text-gray-400 mt-1">Tanpa batas waktu — mati manual doang</p>
            )}
            {!settings.active && settings.scheduledStartAt && (
              <p className="text-xs text-amber-400/80 mt-1">
                Terjadwal auto-mulai: {new Date(settings.scheduledStartAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>

          {settings.active ? (
            <button
              onClick={handleStopNow}
              disabled={busy}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-2 shrink-0"
            >
              <FaPowerOff size={11} /> Stop Sekarang
            </button>
          ) : (
            <button
              onClick={handleActivateNow}
              disabled={busy}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-2 shrink-0"
            >
              <FaBolt size={11} /> Aktifkan Sekarang
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 mb-3">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 mb-3">
          {error}
        </div>
      )}

      <p className="text-[11px] text-gray-500 mb-3">
        Pas "Aktifkan Sekarang" dipencet (manual atau lewat jadwal otomatis), semua user
        yang subscribe notif langsung dapet push "Event Hari Kemerdekaan Indonesia ke-
        {hutNumber || settings.hutNumber} telah dimulai" — dan KRYNOS Plus jadi gratis
        buat semua akun selama event aktif.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* HUT ke berapa */}
        <div className="rounded-xl border border-border bg-panel p-3">
          <label className="text-xs text-gray-400 flex items-center gap-1.5 mb-2">
            <FaFlag size={10} /> HUT ke berapa
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={hutNumber}
              onChange={(e) => setHutNumber(e.target.value)}
              className="flex-1 bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
            <button
              onClick={handleSaveHutNumber}
              disabled={busy}
              className="text-xs bg-accent/20 text-accent rounded-lg px-3 disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Durasi */}
        <div className="rounded-xl border border-border bg-panel p-3">
          <label className="text-xs text-gray-400 flex items-center gap-1.5 mb-2">
            <FaClock size={10} /> Durasi (jam) — kosong = tanpa batas
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              placeholder="misal 168 (7 hari)"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="flex-1 bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
            <button
              onClick={handleSaveDuration}
              disabled={busy || !settings.active}
              title={!settings.active ? "Aktifkan event dulu buat ubah durasi yang lagi jalan" : ""}
              className="text-xs bg-accent/20 text-accent rounded-lg px-3 disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Simpan di sini cuma buat event yang LAGI AKTIF. Buat event yang belum
            dimulai, durasi dipakai otomatis pas "Aktifkan Sekarang" dipencet.
          </p>
        </div>

        {/* Jadwal otomatis */}
        <div className="rounded-xl border border-border bg-panel p-3 sm:col-span-2">
          <label className="text-xs text-gray-400 flex items-center gap-1.5 mb-2">
            <FaCalendarAlt size={10} /> Jadwal Otomatis (opsional)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">Mulai otomatis</span>
              <input
                type="datetime-local"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">Selesai otomatis (opsional)</span>
              <input
                type="datetime-local"
                value={scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
                className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSchedule}
              disabled={busy}
              className="flex-1 text-xs bg-accent/20 text-accent rounded-lg py-1.5 disabled:opacity-50"
            >
              Simpan Jadwal
            </button>
            <button
              onClick={handleClearSchedule}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-gray-400 border border-border rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              <FaTrash size={10} /> Hapus Jadwal
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Event bakal otomatis aktif (+ kirim notif ke semua user) begitu waktu
            "Mulai otomatis" kelewat, tanpa perlu pencet tombol lagi. Kalau "Selesai
            otomatis" diisi, event juga otomatis mati pas waktunya tiba.
          </p>
        </div>
      </div>
    </div>
  );
}
