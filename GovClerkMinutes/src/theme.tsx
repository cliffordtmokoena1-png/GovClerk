import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  fonts: {
    heading: "'Plus Jakarta Sans Variable', sans-serif",
    body: "'Plus Jakarta Sans Variable', sans-serif",
  },
  colors: {
    messenger: {
      "50": "#D0E6FF",
      "100": "#B9DAFF",
      "200": "#A2CDFF",
      "300": "#7AB8FF",
      "400": "#2E90FF",
      "500": "#0078FF",
      "600": "#0063D1",
      "700": "#0052AC",
      "800": "#003C7E",
      "900": "#002C5C",
    },
    whatsapp: {
      50: "#dffeec",
      100: "#b9f5d0",
      200: "#90edb3",
      300: "#65e495",
      400: "#3cdd78",
      500: "#22c35e",
      600: "#179848",
      700: "#0c6c33",
      800: "#01421c",
      900: "#001803",
    },
    orange: {
      "50": "#fff7ed",
      "100": "#ffedd5",
      "200": "#ffd7a8",
      "300": "#ffbb72",
      "400": "#fd933a",
      "500": "#f97316",
      "600": "#ed5809",
      "700": "#c4410a",
      "800": "#9c3410",
      "900": "#7d2c11",
      "950": "#441406",
    },
  },
});

export default theme;
