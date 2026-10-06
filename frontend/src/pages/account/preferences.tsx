import AccountSettingsLayout from "../../components/account/AccountSettingsLayout";
import PreferenceSettings from "../../components/account/PreferenceSettings";

const Preferences = () => (
  <AccountSettingsLayout
    active="preferences"
    title="account.nav.preferences"
    description="account.section.preferences.description"
  >
    <PreferenceSettings />
  </AccountSettingsLayout>
);

export default Preferences;
