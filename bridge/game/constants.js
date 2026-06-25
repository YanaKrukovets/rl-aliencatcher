export const NAV_HEIGHT = 66;
export const HUD_HEIGHT = 60;
export const GAME_MAX_WIDTH = 800;

export const LEVEL_COLORS = [
  "#64C8FF", "#CC88FF", "#FF6060", "#60FFC0",
  "#FFB84D", "#88DDFF", "#FF88CC", "#60FFB0",
];
export const getLevelColor = (lvl) => LEVEL_COLORS[(lvl - 1) % LEVEL_COLORS.length];

export const LEVEL_PALETTES = [
  { bg: ["#06091c", "#0e1035", "#150d2e", "#1a0828"] }, // blue/indigo
  { bg: ["#110015", "#220030", "#2a0045", "#1a0030"] }, // deep violet
  { bg: ["#1a0008", "#2e0412", "#200210", "#150005"] }, // crimson void
  { bg: ["#001518", "#002835", "#001e28", "#001015"] }, // teal cosmos
  { bg: ["#1a0e00", "#2e1800", "#1e1200", "#100800"] }, // amber nebula
  { bg: ["#001020", "#001e3a", "#001530", "#000c20"] }, // arctic blue
  { bg: ["#1a0015", "#300025", "#250018", "#15000f"] }, // rose cosmos
  { bg: ["#05130d", "#0a2218", "#081a12", "#040e08"] }, // emerald space
];
