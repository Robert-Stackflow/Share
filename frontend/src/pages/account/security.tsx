import AccountSettingsLayout from "../../components/account/AccountSettingsLayout";
import SecuritySettings from "../../components/account/SecuritySettings";

const Security = () => (
  <AccountSettingsLayout
    active="security"
    title="account.nav.security"
    description="account.section.security.description"
  >
    <SecuritySettings />
  </AccountSettingsLayout>
);

export default Security;
