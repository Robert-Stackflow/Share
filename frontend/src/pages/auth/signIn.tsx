import { LoadingOverlay } from "@mantine/core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SignInForm from "../../components/auth/SignInForm";
import Meta from "../../components/Meta";
import useUser from "../../hooks/user.hook";
import useTranslate from "../../hooks/useTranslate.hook";

const SignIn = () => {
  const { refreshUser } = useUser();
  const router = useRouter();
  const redirectPath =
    typeof router.query.redirect === "string" ? router.query.redirect : undefined;
  const t = useTranslate();

  const [isLoading, setIsLoading] = useState(redirectPath ? true : false);

  // If the access token is expired, the middleware redirects to this page.
  // If the refresh token is still valid, the user will be redirected to the last page.
  useEffect(() => {
    refreshUser().then((user) => {
      if (user) {
        router.replace(redirectPath ?? "/upload");
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  if (isLoading)
    return (
      <LoadingOverlay overlayProps={{ backgroundOpacity: 1 }} visible />
    );

  return (
    <>
      <Meta title={t("signin.title")} />
      <SignInForm redirectPath={redirectPath ?? "/upload"} />
    </>
  );
};
export default SignIn;
