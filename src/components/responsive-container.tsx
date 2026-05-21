import { View, ViewStyle, StyleProp } from "react-native";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
};

// Centers content with a max width — no-op on phones (where width is already
// below the cap), takes effect on iPad/tablet where the screen would otherwise
// stretch phone-shaped layouts edge to edge.
export function ResponsiveContainer({ children, maxWidth = 560, style }: Props) {
  return (
    <View style={[{ flex: 1, alignSelf: "center", width: "100%", maxWidth }, style]}>
      {children}
    </View>
  );
}
