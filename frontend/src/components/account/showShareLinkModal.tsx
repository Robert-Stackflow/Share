import { Stack, TextInput } from "@mantine/core";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import { translateOutsideContext } from "../../hooks/useTranslate.hook";

const showShareLinkModal = (
  modals: ModalsContextProps,
  shareId: string,
  appUrl: string,
  defaultAppUrl: string,
  pickupCode?: string,
) => {
  const t = translateOutsideContext();
  const link = `${appUrl !== defaultAppUrl ? appUrl : window.location.origin}/s/${shareId}`;
  return modals.openModal({
    title: pickupCode ? t("pickup.code") : t("account.shares.modal.share-link"),
    children: (
      <Stack align="stretch">
        <TextInput readOnly variant="filled" value={pickupCode ?? link} />
      </Stack>
    ),
  });
};

export default showShareLinkModal;
