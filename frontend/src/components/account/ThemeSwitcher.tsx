import { Laptop, Moon, Sun } from "lucide-react";
import {
  Box,
  Center,
  MantineColorScheme,
  SegmentedControl,
  Stack,
  useMantineColorScheme,
} from "@mantine/core";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import userPreferences from "../../utils/userPreferences.util";

const ThemeSwitcher = () => {
  const [colorScheme, setColorScheme] = useState(
    userPreferences.get("colorScheme"),
  );
  const { setColorScheme: setMantineColorScheme } = useMantineColorScheme();
  return (
    <Stack>
      <SegmentedControl
        value={colorScheme}
        onChange={(value) => {
          userPreferences.set("colorScheme", value);
          setColorScheme(value);
          setMantineColorScheme(
            value === "system" ? "auto" : (value as MantineColorScheme),
          );
        }}
        data={[
          {
            label: (
              <Center>
                <Moon size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.dark" />
                </Box>
              </Center>
            ),
            value: "dark",
          },
          {
            label: (
              <Center>
                <Sun size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.light" />
                </Box>
              </Center>
            ),
            value: "light",
          },
          {
            label: (
              <Center>
                <Laptop size={16} />
                <Box ml={10}>
                  <FormattedMessage id="account.theme.system" />
                </Box>
              </Center>
            ),
            value: "system",
          },
        ]}
      />
    </Stack>
  );
};

export default ThemeSwitcher;
