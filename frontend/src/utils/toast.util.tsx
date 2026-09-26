import { Check, X } from "lucide-react";
import { NotificationData, notifications } from "@mantine/notifications";
import FormattedMessage from "../components/core/FormattedMessage";
import { getApiErrorMessage } from "./error.util";
import { ReactNode } from "react";

const error = (
  message: ReactNode,
  config?: Omit<NotificationData, "message">,
) =>
  notifications.show({
    icon: <X size={18} />,
    color: "red",
    radius: "lg",
    message: message,
    autoClose: 5000,
    ...config,
    withCloseButton: false,
  });

const axiosError = (axiosError: any) =>
  error(
    getApiErrorMessage(axiosError) ?? (
      <FormattedMessage id="common.error.unknown" />
    ),
  );

const success = (
  message: ReactNode,
  config?: Omit<NotificationData, "message">,
) =>
  notifications.show({
    icon: <Check size={18} />,
    color: "green",
    radius: "lg",
    message: message,
    autoClose: 3500,
    ...config,
    withCloseButton: false,
  });

const toast = {
  error,
  success,
  axiosError,
};
export default toast;
