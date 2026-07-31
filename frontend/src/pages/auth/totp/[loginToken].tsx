import useTranslate from "../../../hooks/useTranslate.hook";
import Meta from "../../../components/Meta";
import TotpForm from "../../../components/auth/TotpForm";
import { useRouter } from "next/router";
import { GetStaticPaths, GetStaticProps } from "next";
import useStaticRouteParam from "../../../hooks/staticRouteParam.hook";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { loginToken: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: {} });

const Totp = () => {
  const t = useTranslate();
  const router = useRouter();
  const loginToken = useStaticRouteParam("loginToken", 2);

  return (
    <>
      <Meta title={t("totp.title")} />
      <TotpForm
        loginToken={loginToken}
        redirectPath={(router.query.redirect as string) || "/upload"}
      />
    </>
  );
};

export default Totp;
