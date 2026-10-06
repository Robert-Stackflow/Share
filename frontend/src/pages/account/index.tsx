import AccountSettingsLayout from "../../components/account/AccountSettingsLayout";
import ProfileSettings from "../../components/account/ProfileSettings";

const Account = () => (
  <AccountSettingsLayout
    active="profile"
    title="account.nav.profile"
    description="account.section.profile.description"
  >
    <ProfileSettings />
  </AccountSettingsLayout>
);

export default Account;
