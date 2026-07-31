import { LoadingOverlay } from "@mantine/core";
import { useModals } from "@mantine/modals";
import { GetStaticPaths, GetStaticProps } from "next";
import { useEffect, useState } from "react";
import showErrorModal from "../../components/share/showErrorModal";
import useTranslate from "../../hooks/useTranslate.hook";
import useStaticRouteParam from "../../hooks/staticRouteParam.hook";
import inboxService from "../../services/inbox.service";
import Upload from "../upload";

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { token: "_" } }],
  fallback: false,
});
export const getStaticProps: GetStaticProps = async () => ({ props: { inboxToken: "_" } });

const InboxUpload = () => {
  const inboxToken = useStaticRouteParam("token", 1);
  const modals = useModals();
  const t = useTranslate();
  const [isLoading, setIsLoading] = useState(true);

  const [maxShareSize, setMaxShareSize] = useState(0);
  const [simplified, setSimplified] = useState(false);

  useEffect(() => {
    if (!inboxToken) return;
    inboxService
      .setInbox(inboxToken)
      .then((inbox) => {
        setMaxShareSize(parseInt(inbox.maxShareSize));
        setSimplified(inbox.simplified);
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
  }, [inboxToken]);

  if (!inboxToken || isLoading) return <LoadingOverlay visible />;

  return (
    <Upload
      inboxToken={inboxToken}
      isReverseShare
      maxShareSize={maxShareSize}
      simplified={simplified}
    />
  );
};

export default InboxUpload;
