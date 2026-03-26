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
      <Stack.Screen
        name="index"
        options={{
          title: "Collection",
          headerTitleStyle: { color: "#F5F5F7" },
          headerTransparent: process.env.EXPO_OS === "ios",
          headerBlurEffect: process.env.EXPO_OS === "ios" ? "dark" : undefined,
        }}
      />
      <Stack.Screen
        name="details"
        options={{ title: "Card Details", headerTintColor: "#F5F5F7" }}
      />
    </Stack>
  );
}
