import { KeyRound, PackageOpen } from "lucide-react";
import {
  Alert,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { FormEvent, useState } from "react";
import Meta from "../components/Meta";
import useTranslate from "../hooks/useTranslate.hook";
import shareService from "../services/share.service";

export default function PickupPage() {
  const t = useTranslate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await shareService.redeemPickupCode(code);
      window.location.assign(`/share/${result.id}/`);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Meta title={t("pickup.title")} />
      <Center mih="min(70vh, 620px)" px="md">
        <Paper
          withBorder
          radius="lg"
          p={{ base: "lg", sm: "xl" }}
          w="100%"
          maw={440}
        >
          <form onSubmit={redeem}>
            <Stack gap="lg">
              <PackageOpen
                size={30}
                color="var(--mantine-primary-color-filled)"
              />
              <div>
                <Title order={2}>{t("pickup.title")}</Title>
                <Text c="dimmed" size="sm" mt={6}>
                  {t("pickup.description")}
                </Text>
              </div>
              <TextInput
                autoComplete="off"
                label={t("pickup.code")}
                placeholder={t("pickup.placeholder")}
                leftSection={<KeyRound size={17} />}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.currentTarget.value.replace(/\D/g, ""));
                  setError(false);
                }}
              />
              {error && <Alert color="red">{t("pickup.invalid")}</Alert>}
              <Button
                type="submit"
                loading={loading}
                disabled={code.length !== 6}
              >
                {t("pickup.open")}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Center>
    </>
  );
}
