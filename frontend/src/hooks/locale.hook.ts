import { createContext, useContext } from "react";

type LocaleContextValue = {
  language: string;
  changeLanguage: (language: string) => Promise<boolean>;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("LocaleContext is missing");
  return context;
};

export default useLocale;
