import { useEffect, useRef, useState } from "react";

export type LiveSyncStatus = "connecting" | "connected" | "reconnecting";

/** The stream is only a change signal. A fresh room snapshot also repairs missed events. */
const useLiveSync = (url: string | null, refresh: () => Promise<void>) => {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const [status, setStatus] = useState<LiveSyncStatus>("connecting");

  useEffect(() => {
    if (!url) return;

    let active = true;
    let refreshing = false;
    let refreshAgain = false;
    const sync = async () => {
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      do {
        refreshAgain = false;
        try {
          await refreshRef.current();
        } catch {
          if (active) setStatus("reconnecting");
        }
      } while (active && refreshAgain);
      refreshing = false;
    };

    const stream = new EventSource(url);
    setStatus("connecting");
    stream.onopen = () => {
      if (!active) return;
      setStatus("connected");
      void sync();
    };
    stream.onmessage = () => {
      if (active) void sync();
    };
    stream.onerror = () => {
      if (active) setStatus("reconnecting");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      stream.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url]);

  return status;
};

export default useLiveSync;
