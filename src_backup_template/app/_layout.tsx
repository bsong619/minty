/**
 * TEMPORARY PLACEHOLDER — delete this file when building the app.
 * Replace with real screens and choose the best navigation layout (e.g. tabs, stack, drawer) for the requested app.
 */
import { ThemeProvider } from "@/components/theme-provider";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
