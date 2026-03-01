"use client";

import { motion } from "framer-motion";

export function WiringVisual({ className = "" }: { className?: string }) {
  // Patch panel ports (left side)
  const ports = Array.from({ length: 8 }, (_, i) => ({
    x: 30,
    y: 50 + i * 24,
  }));

  // Endpoint positions (right side)
  const endpoints = [
    { x: 230, y: 50, label: "Cat6" },
    { x: 230, y: 86, label: "Cat6" },
    { x: 230, y: 122, label: "Cat6a" },
    { x: 230, y: 158, label: "Cat6a" },
    { x: 230, y: 194, label: "Fiber" },
    { x: 230, y: 218, label: "Fiber" },
    { x: 230, y: 242, label: "Coax" },
    { x: 230, y: 242, label: "Coax" },
  ];

  const cableColors = [
    "#06b6d4", "#06b6d4", "#0891b2", "#0891b2",
    "#22d3ee", "#22d3ee", "#67e8f9", "#67e8f9",
  ];

  return (
    <svg viewBox="0 0 260 260" fill="none" className={className}>
      {/* Patch panel frame */}
      <motion.rect
        x="15"
        y="35"
        width="40"
        height="210"
        rx="4"
        stroke="#06b6d4"
        strokeWidth="1.5"
        fill="#164e63"
        fillOpacity="0.3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Patch panel label */}
      <motion.text
        x="35"
        y="28"
        textAnchor="middle"
        fill="#06b6d4"
        fontSize="8"
        fontFamily="monospace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.3 }}
      >
        PATCH
      </motion.text>

      {/* Cable runs from patch panel to endpoints */}
      {ports.map((port, i) => {
        const ep = endpoints[i];
        const midX = 80 + (i % 3) * 30;
        return (
          <motion.path
            key={i}
            d={`M${port.x + 20} ${port.y} C${midX} ${port.y}, ${midX} ${ep.y}, ${ep.x - 15} ${ep.y}`}
            stroke={cableColors[i]}
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ duration: 1.2, delay: 0.3 + i * 0.12 }}
          />
        );
      })}

      {/* Patch panel ports */}
      {ports.map((port, i) => (
        <motion.g key={`port-${i}`}>
          <motion.rect
            x={port.x - 6}
            y={port.y - 6}
            width="12"
            height="12"
            rx="2"
            fill="#12121c"
            stroke="#06b6d4"
            strokeWidth="1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          />
          <motion.circle
            cx={port.x}
            cy={port.y}
            r="3"
            fill="#22d3ee"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, delay: i * 0.25, repeat: Infinity }}
          />
        </motion.g>
      ))}

      {/* Endpoint wall plates */}
      {endpoints.slice(0, 7).map((ep, i) => (
        <motion.g key={`ep-${i}`}>
          <motion.rect
            x={ep.x - 8}
            y={ep.y - 8}
            width="16"
            height="16"
            rx="3"
            fill="#12121c"
            stroke={cableColors[i]}
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 1 + i * 0.08 }}
          />
          <motion.circle
            cx={ep.x}
            cy={ep.y}
            r="3"
            fill={cableColors[i]}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity }}
          />
        </motion.g>
      ))}

      {/* Data flow particles */}
      {[0, 2, 4].map((i) => {
        const ep = endpoints[i];
        const port = ports[i];
        const midX = 80 + (i % 3) * 30;
        return (
          <motion.circle
            key={`particle-${i}`}
            r="2"
            fill="#22d3ee"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              cx: [port.x + 20, midX, midX, ep.x - 15],
              cy: [port.y, port.y, ep.y, ep.y],
            }}
            transition={{ duration: 3, delay: 2 + i * 0.8, repeat: Infinity }}
          />
        );
      })}
    </svg>
  );
}
