import React from "react";
import { StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ICON_PATHS, IconName } from "./icons";

export type { IconName };

// Ikon vektor (path SVG) tanpa font, sehingga selalu tampil di APK maupun Expo Go.
export function AppIcon({ name, size = 22, color = "#171725", style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: size, height: size }, style]}>
    <Svg width={size} height={size} viewBox="0 0 1000 1000"><Path d={ICON_PATHS[name]} fill={color} /></Svg>
  </View>;
}

// Ikon di depan teks pada satu baris (menggantikan ikon inline di dalam <Text>).
export function IconText({ icon, size = 14, color, gap = 6, style, children }: { icon: IconName; size?: number; color: string; gap?: number; style?: StyleProp<TextStyle>; children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
    <AppIcon name={icon} size={size} color={color} style={{ marginRight: gap }} />
    <Text style={style}>{children}</Text>
  </View>;
}
