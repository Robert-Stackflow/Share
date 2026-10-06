import LanguagePicker from "./LanguagePicker";
import ThemeSwitcher from "./ThemeSwitcher";
import { AccountPanel } from "./AccountSettingsLayout";
import classes from "./AccountSettings.module.css";

const PreferenceSettings = () => (
  <>
    <AccountPanel
      title="account.card.language.title"
      description="account.card.language.description"
    >
      <div className={classes.preferenceControl}>
        <LanguagePicker />
      </div>
    </AccountPanel>
    <AccountPanel
      title="account.card.color.title"
      description="account.preferences.theme.description"
    >
      <div className={classes.preferenceControl}>
        <ThemeSwitcher />
      </div>
    </AccountPanel>
  </>
);

export default PreferenceSettings;
