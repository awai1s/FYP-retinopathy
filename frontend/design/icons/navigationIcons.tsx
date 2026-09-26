/**
 * DR-Healthcare Navigation Icon Mapping Utility
 */

import React from "react";
import { Ionicons } from "@expo/vector-icons";

export type IconName = keyof typeof Ionicons.glyphMap;

interface NavIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const NavIcon: React.FC<NavIconProps> = ({
  name,
  size = 22,
  color = "#FFFFFF",
}) => {
  return <Ionicons name={name} size={size} color={color} />;
};

export default NavIcon;
