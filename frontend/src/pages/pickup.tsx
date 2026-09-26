import { PackageOpen } from "lucide-react";
import {
  Alert,
  Button,
  Center,
  Paper,
  PinInput,
  Stack,
  Text,
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
              <Title order={2}>{t("pickup.title")}</Title>
              <Stack gap="xs">
                <Text c="dimmed" size="sm" fw={500}>
                  {t("pickup.code")}
                </Text>
                <PinInput
                  ariaLabel={t("pickup.code")}
                  getInputProps={(index) => ({
                    "aria-label": `${t("pickup.code")} ${index + 1}/6`,
                  })}
                  length={6}
                  type="number"
                  oneTimeCode={false}
                  radius="md"
                  placeholder=""
                  styles={{
                    root: {
                      display: "grid",
                      width: "100%",
                      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                      gap: 8,
                    },
                    pinInput: {
                      width: "100%",
                      minWidth: 0,
                      height: "clamp(40px, 10vw, 52px)",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                    },
                  }}
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setError(false);
                  }}
                />
              </Stack>
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
