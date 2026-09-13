"use client";

import { SessionProvider } from "next-auth/react";
import UpdateChecker from "./UpdateChecker";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import InstallPrompt from "./InstallPrompt";
import ActivityTracker from "./ActivityTracker";
import PushNotificationSetup from "./PushNotificationSetup";
import EventStatusProvider from "./EventStatusProvider";
import IndependenceDayBanner from "./IndependenceDayBanner";
import FloatingNavButton from "./FloatingNavButton";
import LanguageProvider from "@/lib/i18n/LanguageProvider";
import MusicPlayerProvider from "@/lib/music/MusicPlayerProvider";
import MusicDisc from "./MusicDisc";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // CATATAN: sempat dicoba hydrate `session` langsung dari server (lewat
    // getServerSession di app/layout.tsx) biar gak ada jeda "loading akun"
    // pas buka halaman. TERNYATA itu bikin race condition yang JAUH lebih
    // parah — abis login GitHub sukses, sempat ke-baca status
    // "unauthenticated" sepersekian detik (sebelum client selesai
    // re-verifikasi), dan itu langsung nge-trigger redirect paksa balik ke
    // /login. Direvert total, DEMI KEAMANAN LOGIN (bug ini jauh lebih parah
    // daripada sekadar jeda loading kosmetik).
    //
    // refetchOnWindowFocus={false} TETAP dipertahankan (ini aman, gak ada
    // race condition) — cuma matiin auto-refetch session tiap tab/app
    // balik fokus, gak ngubah cara status awal ditentukan.
    <SessionProvider refetchOnWindowFocus={false}>
      <LanguageProvider>
        <EventStatusProvider>
          <MusicPlayerProvider>
            <ServiceWorkerRegister />
            <UpdateChecker />
            <InstallPrompt />
            <ActivityTracker />
            <PushNotificationSetup />
            <IndependenceDayBanner />
            <FloatingNavButton />
            <MusicDisc />
            {children}
          </MusicPlayerProvider>
        </EventStatusProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
