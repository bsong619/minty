import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/components/auth-provider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs as WebTabs } from "expo-router/tabs";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, useWindowDimensions } from "react-native";

export default function TabsLayout() {
  return (
    <TabsNav />
  );
}

function TabsNav() {
  if (process.env.EXPO_OS === "web") {
    return <WebTabsLayout />;
  }
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
      <WebTabs.Screen
        name="(scan)"
        options={{
          title: "Scan",
          tabBarIcon: (props) => (
            <MaterialIcons {...props} name="center-focus-strong" />
          ),
        }}
      />
      <WebTabs.Screen
        name="(collection)"
        options={{
          title: "Collection",
          tabBarIcon: (props) => (
            <MaterialIcons {...props} name="collections" />
          ),
        }}
      />
      <WebTabs.Screen
        name="(settings)"
        options={{
          title: "Settings",
          tabBarIcon: (props) => <MaterialIcons {...props} name="settings" />,
        }}
      />
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
            ios: {
              sf: {
                default: "viewfinder",
                selected: "viewfinder",
              },
            },
            default: {
              src: (
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialIcons}
                  name="center-focus-strong"
                />
              ),
            },
          })}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(collection)">
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          {...Platform.select({
            ios: {
              sf: {
                default: "rectangle.stack",
                selected: "rectangle.stack.fill",
              },
            },
            default: {
              src: (
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialIcons}
                  name="collections"
                />
              ),
            },
          })}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          {...Platform.select({
            ios: {
              sf: {
                default: "gearshape",
                selected: "gearshape.fill",
              },
            },
            default: {
              src: (
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialIcons}
                  name="settings"
                />
              ),
            },
          })}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
