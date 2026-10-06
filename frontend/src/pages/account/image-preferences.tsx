import {
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import CenterLoader from "../../components/core/CenterLoader";
import ImageLibraryLayout, {
  ImagePanel,
} from "../../components/image/ImageLibraryLayout";
import useConfig from "../../hooks/config.hook";
import useTranslate from "../../hooks/useTranslate.hook";
import imageService from "../../services/image.service";
import {
  ImageOutputFormat,
  ImagePreference,
  ImageVisibility,
} from "../../types/image.type";
import toast from "../../utils/toast.util";

const positions = [
  "northwest",
  "north",
  "northeast",
  "west",
  "center",
  "east",
  "southwest",
  "south",
  "southeast",
];

const ImagePreferences = () => {
  const t = useTranslate();
  const config = useConfig();
  const allowPublic = config.get("images.allowPublic") === true;
  const processingEnabled = config.get("images.allowProcessing") === true;
  const [preference, setPreference] = useState<ImagePreference>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    imageService.getPreferences().then(setPreference).catch(toast.axiosError);
  }, []);

  if (!preference) {
    return (
      <ImageLibraryLayout
        active="preferences"
        title="images.preferences.title"
        description="images.preferences.description"
      >
        <ImagePanel>
          <CenterLoader />
        </ImagePanel>
      </ImageLibraryLayout>
    );
  }

  const patch = <K extends keyof ImagePreference>(
    key: K,
    value: ImagePreference[K],
  ) =>
    setPreference((current) =>
      current ? { ...current, [key]: value } : current,
    );

  const save = async () => {
    setSaving(true);
    try {
      const { userId: _userId, ...input } = preference;
      setPreference(await imageService.updatePreferences(input));
      toast.success(t("images.preferences.saved"));
    } catch (error) {
      toast.axiosError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageLibraryLayout
      active="preferences"
      title="images.preferences.title"
      description="images.preferences.description"
    >
      {!processingEnabled ? (
        <Alert color="gray" title={t("images.preferences.disabled")}>
          {t("images.preferences.disabledDescription")}
        </Alert>
      ) : null}

      <ImagePanel
        title="images.preferences.uploadDefaults"
        description="images.preferences.uploadDefaultsDescription"
      >
        <Stack gap="lg">
          <Select
            label={t("images.preferences.defaultVisibility")}
            value={preference.defaultVisibility}
            allowDeselect={false}
            data={[
              ...(allowPublic
                ? [
                    {
                      value: "PUBLIC",
                      label: t("images.visibility.public"),
                    },
                  ]
                : []),
              {
                value: "PRIVATE",
                label: t("images.visibility.private"),
              },
            ]}
            onChange={(value) =>
              patch(
                "defaultVisibility",
                (value as ImageVisibility) ?? "PRIVATE",
              )
            }
          />
          <Switch
            checked={preference.deduplicate}
            label={t("images.preferences.deduplicate")}
            description={t("images.preferences.deduplicateDescription")}
            onChange={(event) =>
              patch("deduplicate", event.currentTarget.checked)
            }
          />
        </Stack>
      </ImagePanel>

      <ImagePanel
        title="images.preferences.processing"
        description="images.preferences.processingDescription"
      >
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Select
              disabled={!processingEnabled}
              label={t("images.preferences.outputFormat")}
              value={preference.outputFormat}
              allowDeselect={false}
              data={[
                { value: "ORIGINAL", label: t("images.format.original") },
                { value: "JPEG", label: "JPEG" },
                { value: "PNG", label: "PNG" },
                { value: "WEBP", label: "WebP" },
                { value: "AVIF", label: "AVIF" },
              ]}
              onChange={(value) =>
                patch(
                  "outputFormat",
                  (value as ImageOutputFormat) ?? "ORIGINAL",
                )
              }
            />
            <NumberInput
              disabled={!processingEnabled}
              label={t("images.preferences.quality")}
              min={1}
              max={100}
              value={preference.quality}
              onChange={(value) => patch("quality", Number(value) || 82)}
            />
            <NumberInput
              disabled={!processingEnabled}
              label={t("images.preferences.maxWidth")}
              description={t("images.preferences.maxWidthDescription")}
              min={320}
              max={16384}
              value={preference.maxWidth ?? ""}
              onChange={(value) =>
                patch("maxWidth", value === "" ? null : Number(value))
              }
            />
            <div>
              <Switch
                disabled={!processingEnabled}
                checked={preference.autoOrient}
                label={t("images.preferences.autoOrient")}
                onChange={(event) =>
                  patch("autoOrient", event.currentTarget.checked)
                }
              />
              <Switch
                mt="md"
                disabled={!processingEnabled}
                checked={preference.stripMetadata}
                label={t("images.preferences.stripMetadata")}
                onChange={(event) =>
                  patch("stripMetadata", event.currentTarget.checked)
                }
              />
            </div>
          </SimpleGrid>
        </Stack>
      </ImagePanel>

      <ImagePanel
        title="images.preferences.watermark"
        description="images.preferences.watermarkDescription"
      >
        <Stack gap="lg">
          <Switch
            disabled={!processingEnabled}
            checked={preference.watermarkEnabled}
            label={t("images.preferences.watermarkEnabled")}
            onChange={(event) =>
              patch("watermarkEnabled", event.currentTarget.checked)
            }
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <TextInput
              disabled={!processingEnabled || !preference.watermarkEnabled}
              label={t("images.preferences.watermarkText")}
              maxLength={120}
              value={preference.watermarkText ?? ""}
              onChange={(event) =>
                patch("watermarkText", event.currentTarget.value || null)
              }
            />
            <Select
              disabled={!processingEnabled || !preference.watermarkEnabled}
              label={t("images.preferences.watermarkPosition")}
              value={preference.watermarkPosition}
              allowDeselect={false}
              data={positions.map((position) => ({
                value: position,
                label: t(`images.position.${position}`),
              }))}
              onChange={(value) =>
                patch("watermarkPosition", value ?? "southeast")
              }
            />
            <NumberInput
              disabled={!processingEnabled || !preference.watermarkEnabled}
              label={t("images.preferences.watermarkOpacity")}
              min={1}
              max={100}
              suffix="%"
              value={preference.watermarkOpacity}
              onChange={(value) =>
                patch("watermarkOpacity", Number(value) || 30)
              }
            />
          </SimpleGrid>
        </Stack>
      </ImagePanel>

      <Group justify="flex-end">
        <Button
          loading={saving}
          leftSection={<Save size={16} />}
          onClick={() => void save()}
        >
          {t("common.button.save")}
        </Button>
      </Group>
    </ImageLibraryLayout>
  );
};

export default ImagePreferences;
