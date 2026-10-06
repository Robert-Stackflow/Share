import { Code, CopyButton, Group, Stack, Text } from "@mantine/core";
import AppCredentialManager from "../../components/account/AppCredentialManager";
import ImageLibraryLayout, {
  ImagePanel,
} from "../../components/image/ImageLibraryLayout";
import useTranslate from "../../hooks/useTranslate.hook";

const ImageClients = () => {
  const t = useTranslate();
  const endpoint =
    typeof window === "undefined"
      ? "/api/image-api/images"
      : `${window.location.origin}/api/image-api/images`;

  return (
    <ImageLibraryLayout
      active="clients"
      title="images.clients.title"
      description="images.clients.description"
    >
      <ImagePanel
        id="image-api-tokens"
        title="images.clients.tokens"
        description="images.clients.tokensDescription"
      >
        <AppCredentialManager mode="image" />
      </ImagePanel>
      <ImagePanel
        title="images.clients.clipper"
        description="images.clients.clipperDescription"
      >
        <Stack gap="md">
          {[
            [t("images.clients.uploadUrl"), endpoint],
            [t("images.clients.auth"), "Bearer Token"],
            [t("images.clients.requestFormat"), t("images.clients.rawPng")],
            [t("images.clients.responsePath"), "url"],
          ].map(([label, value]) => (
            <Group justify="space-between" key={label} wrap="nowrap">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <CopyButton value={value}>
                {({ copied, copy }) => (
                  <Code onClick={copy} style={{ cursor: "pointer" }}>
                    {copied ? t("images.copy.copied") : value}
                  </Code>
                )}
              </CopyButton>
            </Group>
          ))}
        </Stack>
      </ImagePanel>
      <ImagePanel
        title="images.clients.headers"
        description="images.clients.headersDescription"
      >
        <Stack gap="xs">
          <Code block>Authorization: Bearer share_your_token</Code>
          <Code block>Content-Type: image/png</Code>
          <Code block>X-File-Name: screenshot.png</Code>
          <Code block>X-Image-Visibility: PUBLIC</Code>
          <Code block>X-Image-Album: optional-album-uuid</Code>
        </Stack>
      </ImagePanel>
    </ImageLibraryLayout>
  );
};

export default ImageClients;
