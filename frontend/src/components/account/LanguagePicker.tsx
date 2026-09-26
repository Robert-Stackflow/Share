import { Select } from "@mantine/core";
import { useState } from "react";
import useTranslate from "../../hooks/useTranslate.hook";
import useLocale from "../../hooks/locale.hook";
import { LOCALES } from "../../i18n/locales";
import toast from "../../utils/toast.util";

const LanguagePicker = () => {
  const t = useTranslate();
  const { language, changeLanguage } = useLocale();
  const [changing, setChanging] = useState(false);

  const languages = Object.values(LOCALES).map((locale) => ({
    value: locale.code,
    label: locale.name,
  }));
  return (
    <Select
      value={language}
      disabled={changing}
      onChange={(value) => {
        if (!value || value === language) return;
        setChanging(true);
        void changeLanguage(value).then((changed) => {
          setChanging(false);
          if (!changed) toast.error(t("account.card.language.error"));
        });
      }}
      data={languages}
    />
  );
};

export default LanguagePicker;
