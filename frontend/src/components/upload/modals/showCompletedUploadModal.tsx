import {
  Button,
  Stack,
  Text,
  Collapse,
  TextInput,
  Group,
  useComputedColorScheme,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { useState } from "react";
import moment from "moment";
import { useRouter } from "next/router";
import FormattedMessage from "../../core/FormattedMessage";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import { CompletedShare } from "../../../types/share.type";
import CopyTextField from "../CopyTextField";
import QRCode from "../../share/QRCode";
import toast from "../../../utils/toast.util";

const showCompletedUploadModal = (
  modals: ModalsContextProps,
  share: CompletedShare,
  appUrl: string,
  defaultAppUrl: string,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    closeOnClickOutside: false,
    withCloseButton: false,
    closeOnEscape: false,
    title: t("upload.modal.completed.share-ready"),
    children: (
      <Body share={share} appUrl={appUrl} defaultAppUrl={defaultAppUrl} />
    ),
  });
};

const Body = ({
  share,
  appUrl,
  defaultAppUrl,
}: {
  share: CompletedShare;
  appUrl: string;
  defaultAppUrl: string;
}) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();
  const colorScheme = useComputedColorScheme("light");
  const clipboard = useClipboard();

  const [showQR, setShowQR] = useState(false);

  const handleToggleQR = () => {
    setShowQR(!showQR);
  };

  const isReverseShare = !!router.query["reverseShareToken"];

  const link = `${appUrl !== defaultAppUrl ? appUrl : window.location.origin}/s/${share.id}`;

  return (
    <Stack align="stretch">
      {share.pickupCode ? (
        <>
          <Text size="sm" c="dimmed">
            {t("upload.modal.completed.pickupInstructions")}
          </Text>
          <Group align="end" wrap="nowrap">
            <TextInput
              readOnly
              label={t("pickup.code")}
              value={share.pickupCode}
              styles={{ input: { fontWeight: 700, letterSpacing: "0.1em" } }}
              style={{ flex: 1 }}
            />
            <Button
              variant="light"
              onClick={() => {
                clipboard.copy(share.pickupCode);
                toast.success(t("pickup.copied"));
              }}
            >
              {t("common.button.copy")}
            </Button>
          </Group>
          <Text size="sm" c="dimmed">
            {t("pickup.entry")}:{" "}
            {`${appUrl !== defaultAppUrl ? appUrl : window.location.origin}/pickup/`}
          </Text>
        </>
      ) : (
        <>
          <CopyTextField link={link} toggleQR={handleToggleQR} />
          <Collapse in={showQR}>
            <QRCode link={link} />
          </Collapse>
        </>
      )}
      {share.notifyReverseShareCreator === true && (
        <Text size="sm" c={colorScheme === "dark" ? "gray.3" : "dark.4"}>
          {t("upload.modal.completed.notified-reverse-share-creator")}
        </Text>
      )}
      <Text size="xs" c="gray.6">
        {/* If our share.expiration is timestamp 0, show a different message */}
        {moment(share.expiration).unix() === 0
          ? t("upload.modal.completed.never-expires")
          : t("upload.modal.completed.expires-on", {
              expiration: moment(share.expiration).format("LLL"),
            })}
      </Text>

      <Button
        onClick={() => {
          modals.closeAll();
          if (isReverseShare) {
            router.reload();
          } else {
            router.push("/upload");
          }
        }}
      >
        <FormattedMessage id="common.button.done" />
      </Button>
    </Stack>
  );
};

export default showCompletedUploadModal;
