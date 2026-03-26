import { DarkTheme, ThemeProvider as RNTheme } from "@react-navigation/native";

export function ThemeProvider(props: { children: React.ReactNode }) {
  return <RNTheme value={DarkTheme}>{props.children}</RNTheme>;
}
