import { useModals } from "@mantine/modals";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import showConfirmDialog from "../components/core/showConfirmDialog";
import useTranslate from "./useTranslate.hook";

const useConfirmLeave = ({
  message,
  enabled,
}: {
  message: string;
  enabled: boolean;
}) => {
  const router = useRouter();
  const modals = useModals();
  const t = useTranslate();
  const dialogId = useRef<string | null>(null);
  const bypassNextChange = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleRouteChange = (url: string) => {
      if (bypassNextChange.current) {
        bypassNextChange.current = false;
        return;
      }

      router.events.emit("routeChangeError");
      if (!dialogId.current) {
        dialogId.current = showConfirmDialog(modals, {
          title: t("common.button.confirm"),
          message,
          confirmLabel: t("common.button.confirm"),
          cancelLabel: t("common.button.cancel"),
          destructive: false,
          onCancel: () => {
            dialogId.current = null;
          },
          onConfirm: () => {
            dialogId.current = null;
            bypassNextChange.current = true;
            void router.push(url);
          },
        });
      }
      throw "Route change aborted.";
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    router.events.on("routeChangeStart", handleRouteChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (dialogId.current) {
        modals.closeModal(dialogId.current);
        dialogId.current = null;
      }
    };
  }, [enabled, message, modals, router, t]);
};

export default useConfirmLeave;
