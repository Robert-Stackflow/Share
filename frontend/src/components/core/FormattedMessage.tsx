import { ComponentProps } from "react";
import { FormattedMessage as IntlFormattedMessage, useIntl } from "react-intl";
import i18nUtil from "../../utils/i18n.util";

type Props = ComponentProps<typeof IntlFormattedMessage>;

const FormattedMessage = ({ id, defaultMessage, ...props }: Props) => {
  const intl = useIntl();
  if (!id) {
    return <>{i18nUtil.missingMessage(intl.locale, "<missing id>")}</>;
  }
  const missing = !Object.prototype.hasOwnProperty.call(intl.messages, id);
  const fallback = missing
    ? i18nUtil.missingMessage(intl.locale, String(id))
    : undefined;

  return (
    <IntlFormattedMessage
      {...props}
      id={id}
      defaultMessage={defaultMessage ?? fallback}
    />
  );
};

export default FormattedMessage;
