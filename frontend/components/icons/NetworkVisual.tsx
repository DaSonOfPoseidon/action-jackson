"use client";

import { motion } from "framer-motion";

export function NetworkVisual({ className = "" }: { className?: string }) {
  const nodes = [
    { cx: 80, cy: 30 },
    { cx: 160, cy: 20 },
    { cx: 220, cy: 60 },
    { cx: 240, cy: 140 },
    { cx: 200, cy: 210 },
    { cx: 120, cy: 230 },
    { cx: 40, cy: 190 },
    { cx: 20, cy: 100 },
  ];
  const center = { cx: 130, cy: 125 };

  return (
    <svg viewBox="0 0 260 260" fill="none" className={className}>
      {/* Connection lines from center to each node */}
      {nodes.map((n, i) => (
        <motion.line
          key={i}
          x1={center.cx}
          y1={center.cy}
          x2={n.cx}
          y2={n.cy}
          stroke="#16a34a"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
        />
      ))}

      {/* Outer nodes */}
      {nodes.map((n, i) => (
        <motion.g key={`node-${i}`}>
          <motion.circle
            cx={n.cx}
            cy={n.cy}
            r="8"
            fill="#12121c"
            stroke="#16a34a"
            strokeWidth="1.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.08 }}
          />
          <motion.circle
            cx={n.cx}
            cy={n.cy}
            r="3"
            fill="#22c55e"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
          />
        </motion.g>
      ))}

      {/* Central hub */}
      <motion.circle
        cx={center.cx}
        cy={center.cy}
        r="22"
        fill="#14532d"
        stroke="#16a34a"
        strokeWidth="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      />
      <motion.circle
        cx={center.cx}
        cy={center.cy}
        r="10"
        fill="#22c55e"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Pulse ring */}
      <motion.circle
        cx={center.cx}
        cy={center.cy}
        r="22"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1"
        initial={{ r: 22, opacity: 0.6 }}
        animate={{ r: 60, opacity: 0 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
      />
    </svg>
  );
}
