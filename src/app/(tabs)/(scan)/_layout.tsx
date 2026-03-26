import Stack from "expo-router/stack";

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0A0A0C" },
        headerTintColor: "#F5F5F7",
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: "#0A0A0C" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Minty",
          headerTitleStyle: { color: "#F5F5F7" },
          headerTransparent: process.env.EXPO_OS === "ios",
          headerBlurEffect: process.env.EXPO_OS === "ios" ? "dark" : undefined,
        }}
      />
      <Stack.Screen
        name="camera"
        options={{ title: "", headerShown: false, animation: "fade", presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="analyzing"
        options={{ headerShown: false, animation: "fade", presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="results"
        options={{ title: "Grade Results", headerTintColor: "#F5F5F7" }}
      />
    </Stack>
  );
}
