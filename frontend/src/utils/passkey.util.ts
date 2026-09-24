import { isAxiosError } from "axios";
import toast from "./toast.util";

export const showPasskeyError = (
  error: unknown,
  t: (key: string) => string,
) => {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    toast.error(t("passkey.cancelled"));
  } else if (isAxiosError(error)) {
    if (!error.response) toast.error(t("passkey.networkError"));
    else toast.axiosError(error);
  } else {
    toast.error(t("passkey.failed"));
  }
};
