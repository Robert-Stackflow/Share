import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetStaticPaths, GetStaticProps } from "next";
import { useEffect, useState } from "react";
import Upload from ".";
import showErrorModal from "../../components/share/showErrorModal";
import shareService from "../../services/share.service";
import useTranslate from "../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../hooks/staticRouteParam.hook";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { reverseShareToken: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: { reverseShareToken: "_" } });

const Share = () => {
  const reverseShareToken = useStaticRouteParam("reverseShareToken", 1);
  const modals = useModals();
  const t = useTranslate();
  const [isLoading, setIsLoading] = useState(true);

  const [maxShareSize, setMaxShareSize] = useState(0);
  const [simplified, setSimplified] = useState(false);

  useEffect(() => {
    if (!reverseShareToken) return;
    shareService
      .setReverseShare(reverseShareToken)
      .then((reverseShareTokenData) => {
        setMaxShareSize(parseInt(reverseShareTokenData.maxShareSize));
        setSimplified(reverseShareTokenData.simplified);
        setIsLoading(false);
      })
      .catch(() => {
        showErrorModal(
          modals,
          t("upload.reverse-share.error.invalid.title"),
          t("upload.reverse-share.error.invalid.description"),
          "go-home",
        );
        setIsLoading(false);
      });
  }, [reverseShareToken]);

  if (!reverseShareToken || isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      isReverseShare
      maxShareSize={maxShareSize}
      simplified={simplified}
    />
  );
};

export default Share;
