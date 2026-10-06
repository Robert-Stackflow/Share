import AppCredentialManager from "../../components/account/AppCredentialManager";
import AccountSettingsLayout, {
  AccountPanel,
} from "../../components/account/AccountSettingsLayout";
import WebDavUsagePanel from "../../components/account/WebDavUsagePanel";

const Credentials = () => (
  <AccountSettingsLayout
    active="credentials"
    title="credentials.title"
    description="account.section.credentials.description"
  >
    <AccountPanel
      title="credentials.webdavUsage.title"
      description="credentials.webdavUsage.description"
    >
      <WebDavUsagePanel />
    </AccountPanel>
    <AccountPanel>
      <AppCredentialManager />
    </AccountPanel>
  </AccountSettingsLayout>
);

export default Credentials;
