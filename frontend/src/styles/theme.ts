import { createTheme, MantineThemeOverride } from "@mantine/core";

const theme: MantineThemeOverride = createTheme({
  colors: {
    victoria: [
      "#edf1fb",
      "#dce4f7",
      "#bdcbee",
      "#98ace0",
      "#718bd1",
      "#526dc0",
      "#4059aa",
      "#354b91",
      "#2c3f78",
      "#25355f",
    ],
  },
  primaryColor: "victoria",
  fontFamily: 'Inter, "Segoe UI", "Noto Sans SC", sans-serif',
  headings: {
    fontFamily: 'Inter, "Segoe UI", "Noto Sans SC", sans-serif',
    fontWeight: "650",
  },
  components: {
    Modal: {
      styles: {
        title: {
          fontSize: "var(--mantine-font-size-lg)",
          fontWeight: 700,
        },
      },
    },
  },
});

export default theme;
