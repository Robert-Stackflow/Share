import { Upload } from "lucide-react";
import { FileInput, Stack, Text, Title } from "@mantine/core";
import { Dispatch, SetStateAction } from "react";
import FormattedMessage from "../../core/FormattedMessage";
import useTranslate from "../../../hooks/useTranslate.hook";

const LogoConfigInput = ({
  logo,
  setLogo,
  darkLogo,
  setDarkLogo,
  rowClassName,
  gridClassName,
  controlClassName,
  descriptionClassName,
}: {
  logo: File | null;
  setLogo: Dispatch<SetStateAction<File | null>>;
  darkLogo: File | null;
  setDarkLogo: Dispatch<SetStateAction<File | null>>;
  rowClassName: string;
  gridClassName: string;
  controlClassName: string;
  descriptionClassName: string;
}) => {
  const t = useTranslate();
  const entries = [
    { key: "logo", value: logo, onChange: setLogo },
    { key: "logo-dark", value: darkLogo, onChange: setDarkLogo },
  ];

  return (
    <>
      {entries.map((entry) => (
        <div className={rowClassName} key={entry.key}>
          <div className={gridClassName}>
            <Stack gap={4}>
              <Title order={6}>
                <FormattedMessage id={`admin.config.general.${entry.key}`} />
              </Title>
              <Text className={descriptionClassName} c="dimmed" size="sm">
                <FormattedMessage
                  id={`admin.config.general.${entry.key}.description`}
                />
              </Text>
            </Stack>
            <div className={controlClassName}>
              <FileInput
                clearable
                leftSection={<Upload size={16} />}
                value={entry.value}
                onChange={entry.onChange}
                accept=".png"
                placeholder={t("admin.config.general.logo.placeholder")}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default LogoConfigInput;
