import Stack from "expo-router/stack";

export default function CollectionLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="details"
        options={{ title: "Card Details", headerTintColor: "#F5F5F7" }}
      />
    </Stack>
  );
}
