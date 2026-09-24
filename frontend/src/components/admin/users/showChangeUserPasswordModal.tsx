import { Button, Group, PasswordInput, Stack } from "@mantine/core";
import { useForm, yupResolver } from "@mantine/form";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import FormattedMessage from "../../core/FormattedMessage";
import * as yup from "yup";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import userService from "../../../services/user.service";
import User from "../../../types/user.type";
import toast from "../../../utils/toast.util";
import modalClasses from "../../core/ModalForm.module.css";

const showChangeUserPasswordModal = (
  modals: ModalsContextProps,
  user: User,
  getUsers: () => void,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    title: t("admin.users.edit.password.title", { username: user.username }),
    children: <Body user={user} modals={modals} getUsers={getUsers} />,
  });
};

const Body = ({
  user,
  modals,
  getUsers,
}: {
  modals: ModalsContextProps;
  user: User;
  getUsers: () => void;
}) => {
  const t = useTranslate();
  const formId = `change-user-password-${user.id}`;
  const form = useForm({
    initialValues: {
      password: "",
    },
    validate: yupResolver(
      yup.object().shape({
        password: yup
          .string()
          .required(t("common.error.field-required"))
          .min(8, t("common.error.too-short", { length: 8 })),
      }),
    ),
  });

  return (
    <form
      id={formId}
      onSubmit={form.onSubmit(async (values) => {
        userService
          .update(user.id, {
            password: values.password,
          })
          .then(() => {
            toast.success(t("admin.users.edit.update.notify.password.success"));
            getUsers();
            modals.closeAll();
          })
          .catch(toast.axiosError);
      })}
    >
      <Stack className={modalClasses.modalStack}>
        <div className={modalClasses.section}>
          <PasswordInput
            autoComplete="new-password"
            label={t("admin.users.edit.update.change-password.field")}
            {...form.getInputProps("password")}
          />
        </div>
        <Group className={modalClasses.footer}>
          <Button
            variant="default"
            type="button"
            onClick={() => modals.closeAll()}
          >
            <FormattedMessage id="common.button.cancel" />
          </Button>
          <Button type="submit">
            <FormattedMessage id="admin.users.edit.update.change-password.button" />
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export default showChangeUserPasswordModal;
