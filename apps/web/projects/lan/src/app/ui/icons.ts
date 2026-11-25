// The site's icons, drawn here as SVG paths on a 24-unit grid (stroke 1.75, round caps), in place of the original site's
// FontAwesome kit (a third-party script, which this site does not load). Each icon is a list of path "d" strings, drawn
// by Icon (ui/icon.ts) as decoration: aria-hidden, never the only carrier of a meaning.

// Path helpers: a circle, a (rounded) rectangle and a dot, as path data.
const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r = 0): string =>
  r === 0
    ? `M${x} ${y}h${w}v${h}h${-w}z`
    : `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const dot = (cx: number, cy: number): string => `M${cx} ${cy}h.01`;

export const ICONS = {
  // Interface
  'chevron-down': ['M6 9l6 6 6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  // Networking and the home
  network: [rect(9, 3, 6, 5, 1), rect(3, 16, 6, 5, 1), rect(15, 16, 6, 5, 1), 'M12 8v4', 'M6 16v-2h12v2'],
  globe: [circle(12, 12, 9), 'M3 12h18', 'M12 3c3.2 3 3.2 15 0 18', 'M12 3c-3.2 3-3.2 15 0 18'],
  shield: ['M12 3l8 3v6c0 4.7-3.3 8-8 9-4.7-1-8-4.3-8-9V6z', 'M12 3v18'],
  camera: [rect(3, 7, 13, 10, 2), 'M16 11l5-3v8l-5-3'],
  home: ['M3 11l9-8 9 8', 'M5 9.5V20h14V9.5', 'M10 20v-5h4v5'],
  'smart-home': ['M3 11l9-8 9 8', 'M5 9.5V20h14V9.5', 'M9 15.2a4.2 4.2 0 0 1 6 0', 'M10.8 17.3a1.7 1.7 0 0 1 2.4 0', dot(12, 19)],
  door: [rect(6, 3, 12, 18), 'M3 21h18', dot(15, 12)],
  tower: ['M12 11v10', 'M8 21h8', circle(12, 9, 1.6), 'M8.4 6a4.2 4.2 0 0 0 0 6', 'M15.6 6a4.2 4.2 0 0 1 0 6', 'M5.6 3.6a8 8 0 0 0 0 10.8', 'M18.4 3.6a8 8 0 0 1 0 10.8'],
  wifi: ['M2.5 9a14 14 0 0 1 19 0', 'M5.5 12.5a9.6 9.6 0 0 1 13 0', 'M8.7 15.8a5 5 0 0 1 6.6 0', dot(12, 19.2)],
  ethernet: ['M5 7h14v8h-3v3H8v-3H5z', 'M9 7v3', 'M12 7v3', 'M15 7v3'],
  router: [rect(3, 13, 18, 7, 2), 'M7 13V6', 'M17 13V6', dot(7, 16.5), dot(11, 16.5), 'M14.5 16.5H17'],
  signal: ['M5 20v-4', 'M10 20v-8', 'M15 20V8', 'M20 20V4'],
  gauge: ['M4 17a9 9 0 1 1 16 0', 'M12 14l4-5', circle(12, 14, 1)],
  server: [rect(3, 4, 18, 6, 1.5), rect(3, 14, 18, 6, 1.5), dot(7, 7), dot(7, 17), 'M11 7h6', 'M11 17h6'],
  diagram: [circle(6, 6, 2.5), circle(18, 6, 2.5), circle(12, 18, 2.5), 'M8.5 6h7', 'M7.3 8.3l3.6 7.4', 'M16.7 8.3l-3.6 7.4'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  tools: ['M14.5 5a4.5 4.5 0 0 0 5.2 5.9l-9.3 9.3a2.2 2.2 0 0 1-3.1-3.1l9.3-9.3A4.5 4.5 0 0 0 14.5 5z', dot(8.2, 17.2)],
  card: [rect(2, 5, 20, 14, 2), 'M2 10h20', 'M6 15h4'],
  cloud: ['M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5 3.8 3.8 0 0 1 17.5 18', 'M12 21v-7', 'M9.5 16.5L12 14l2.5 2.5'],
  clock: [circle(12, 12, 9), 'M12 7v5l3 2'],
  lock: [rect(5, 11, 14, 10, 2), 'M8 11V8a4 4 0 0 1 8 0v3', dot(12, 16)],
  drive: [rect(3, 13, 18, 7, 2), 'M3 13l3-8h12l3 8', dot(7, 16.5), 'M11 16.5h6'],
  target: [circle(12, 12, 9), circle(12, 12, 5), circle(12, 12, 1)],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  antenna: [rect(3, 12, 18, 9, 2), 'M8 4l4 8', 'M16 4l-4 8', dot(7, 16.5), 'M11 16.5h6'],
  plug: ['M9 2v5', 'M15 2v5', 'M6 7h12v4a6 6 0 0 1-12 0z', 'M12 17v5'],
  forward: ['M4 6l8 6-8 6z', 'M13 6l8 6-8 6z'],
  alert: [circle(12, 12, 9), 'M12 7v6', dot(12, 16.5)],
  puzzle: ['M4 8h4.5a2.5 2.5 0 1 1 5 0H18v4.5a2.5 2.5 0 1 1 0 5V20H4z'],
  toolbox: [rect(3, 8, 18, 12, 2), 'M9 8V5h6v3', 'M3 13h18', 'M11 13v2h2v-2'],
  expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  record: [circle(12, 12, 9), circle(12, 12, 3)],
  database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', circle(12, 12, 3)],
  pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', circle(12, 10, 2.5)],
  dollar: ['M12 2v20', 'M17 6.5C16 5 14 4.5 12 4.5c-2.5 0-4.5 1.2-4.5 3.2 0 4.5 9 2.3 9 7.1 0 2-2 3.2-4.5 3.2-2.2 0-4.2-.7-5-2.5'],
  clipboard: [rect(5, 4, 14, 17, 2), 'M9 2h6v4H9z', 'M9 13l2 2 4-4'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
