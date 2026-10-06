import AppCredentialManager from "../../components/account/AppCredentialManager";
import AccountSettingsLayout, {
  AccountPanel,
} from "../../components/account/AccountSettingsLayout";

const Credentials = () => (
  <AccountSettingsLayout
    active="credentials"
    title="credentials.title"
    description="account.section.credentials.description"
  >
    <AccountPanel>
      <AppCredentialManager />
    </AccountPanel>
  </AccountSettingsLayout>
);

export default Credentials;
