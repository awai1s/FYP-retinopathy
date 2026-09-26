import colors from "./colors";

export const shadows = {
  none: { shadowColor: "transparent", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 7, elevation: 2 },
  card3D: { shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  elevated3D: { shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 13 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 8 },
  floating: { shadowColor: colors.navyInk, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.24, shadowRadius: 30, elevation: 12 },
  drawer3D: { shadowColor: colors.black, shadowOffset: { width: 10, height: 0 }, shadowOpacity: 0.30, shadowRadius: 28, elevation: 16 },
  neon: { shadowColor: colors.neonAqua, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 16, elevation: 6 },
};

export default shadows;
