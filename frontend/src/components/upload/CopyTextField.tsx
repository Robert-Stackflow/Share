import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { ActionIcon, TextInput, Tooltip } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useRef, useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import toast from "../../utils/toast.util";

function CopyTextField(props: { link: string; toggleQR?: () => void }) {
  const clipboard = useClipboard({ timeout: 500 });
  const t = useTranslate();

  const [checkState, setCheckState] = useState(false);
  const [textClicked, setTextClicked] = useState(false);
  const timerRef = useRef<number | ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const copyLink = () => {
    clipboard.copy(props.link);
    toast.success(t("common.notify.copied-link"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCheckState(false);
    }, 1500);
    setCheckState(true);
  };

  return (
    <TextInput
      readOnly
      label={t("common.text.link")}
      variant="filled"
      value={props.link}
      onClick={() => {
        if (!textClicked) {
          copyLink();
          setTextClicked(true);
        }
      }}
      rightSectionWidth={104}
      rightSection={
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Tooltip
            label={t("common.text.navigate-to-link")}
            position="top"
            offset={-2}
            openDelay={200}
          >
            <ActionIcon
              color="gray"
              component="a"
              href={props.link}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="subtle"
            >
              <ExternalLink />
            </ActionIcon>
          </Tooltip>

          {window.isSecureContext && (
            <>
              <Tooltip
                label={t("common.button.clickToCopy")}
                position="top"
                offset={-2}
                openDelay={200}
              >
                <ActionIcon
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={copyLink}
                >
                  {checkState ? <Check /> : <Copy />}
                </ActionIcon>
              </Tooltip>

              <Tooltip
                label={t("common.button.showQRCode")}
                position="top"
                offset={-2}
                openDelay={200}
              >
                <ActionIcon
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={props.toggleQR}
                >
                  <QrCode />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </div>
      }
    />
  );
}

export default CopyTextField;
