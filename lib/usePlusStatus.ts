"use client";

import { useEffect, useState, useCallback } from "react";

export type PlusStatus = {
  active: boolean;
  isOwnerAccount: boolean;
  expiresAt: string | null;
  eventFree?: boolean;
  hutNumber?: number | null;
};

export function usePlusStatus() {
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plus/status");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { status, loading, reload };
}
