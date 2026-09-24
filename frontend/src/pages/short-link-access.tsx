import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Meta from "../components/Meta";
import CenterLoader from "../components/core/CenterLoader";
import useTranslate from "../hooks/useTranslate.hook";
import useUser from "../hooks/user.hook";
import shortLinkService, { ShortLinkAccessStatus } from "../services/shortLink.service";

export default function ShortLinkAccessPage() {
  const router = useRouter();
  const t = useTranslate();
  const { user } = useUser();
  const code = typeof router.query.code === "string" ? router.query.code : "";
  const [status, setStatus] = useState<ShortLinkAccessStatus>();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    shortLinkService.access(code).then(setStatus).catch(() => setError(t("shortLinkAccess.unavailable")));
  }, [code, t]);

  const open = async () => {
    if (!code || loading) return;
    setLoading(true);
    setError("");
    try {
      const target = await shortLinkService.resolve(code, password);
      window.location.assign(target);
    } catch {
      setError(t("shortLinkAccess.denied"));
      shortLinkService.access(code).then(setStatus).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  if (!router.isReady) return <CenterLoader />;
  return (
    <>
      <Meta title={t("shortLinkAccess.title")} />
      <Center mih="65vh">
        <Paper withBorder p="xl" radius="md" w="100%" maw={440}>
          <Stack>
            <Title order={2}>{status?.title || t("shortLinkAccess.title")}</Title>
            {!code && <Alert color="red">{t("shortLinkAccess.unavailable")}</Alert>}
            {code && !status && !error && <CenterLoader />}
            {status?.status && status.status !== "active" && <Alert color="orange">{t(`shortLinkAccess.${status.status}`)}</Alert>}
            {status?.status === "active" && status.requiresSignIn && !user && (
              <>
                <Text>{t("shortLinkAccess.signInRequired")}</Text>
                <Button component={Link} href={`/auth/signIn/?redirect=${encodeURIComponent(`/short-link-access/?code=${code}`)}`}>
                  {t("shortLinkAccess.signIn")}
                </Button>
              </>
            )}
            {status?.status === "active" && (!status.requiresSignIn || user) && (
              <>
                {status.requiresPassword && <PasswordInput label={t("shortLinkAccess.password")} value={password} onChange={(event) => setPassword(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") void open(); }} />}
                <Button loading={loading} disabled={status.requiresPassword && !password} onClick={() => void open()}>{t("shortLinkAccess.open")}</Button>
              </>
            )}
            {error && <Alert color="red">{error}</Alert>}
          </Stack>
        </Paper>
      </Center>
    </>
  );
}
