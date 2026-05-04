import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs as WebTabs } from "expo-router/tabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, useWindowDimensions } from "react-native";

export default function TabsLayout() {
  if (process.env.EXPO_OS === "web") return <WebTabsLayout />;
  return <NativeTabsLayout />;
}

function WebTabsLayout() {
  const { width } = useWindowDimensions();
  const isMd = width >= 768;
  const isLg = width >= 1024;

  return (
    <WebTabs
      screenOptions={{
        headerShown: false,
        ...(isMd
          ? {
              tabBarPosition: "left",
              tabBarVariant: "material",
              tabBarLabelPosition: isLg ? undefined : "below-icon",
            }
          : { tabBarPosition: "bottom" }),
      }}
    >
      <WebTabs.Screen name="(scan)" options={{
        title: "Scan",
        tabBarIcon: (props) => <MaterialIcons {...props} name="center-focus-strong" />,
      }} />
      <WebTabs.Screen name="(collection)" options={{
        title: "Vault",
        tabBarIcon: (props) => <MaterialIcons {...props} name="auto-awesome-mosaic" />,
      }} />
      <WebTabs.Screen name="(profile)" options={{
        title: "Profile",
        tabBarIcon: (props) => <MaterialIcons {...props} name="person-outline" />,
      }} />
    </WebTabs>
  );
}

function NativeTabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(scan)">
        <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          {...Platform.select({
            ios: { sf: { default: "viewfinder", selected: "viewfinder" } },
            default: { src: <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="center-focus-strong" /> },
          })}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(collection)">
        <NativeTabs.Trigger.Label>Vault</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          {...Platform.select({
            ios: { sf: { default: "rectangle.stack", selected: "rectangle.stack.fill" } },
            default: { src: <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="auto-awesome-mosaic" /> },
          })}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          {...Platform.select({
            ios: { sf: { default: "person.crop.circle", selected: "person.crop.circle.fill" } },
            default: { src: <NativeTabs.Trigger.VectorIcon family={MaterialIcons} name="person-outline" /> },
          })}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
