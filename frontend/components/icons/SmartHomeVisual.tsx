"use client";

import { motion } from "framer-motion";

export function SmartHomeVisual({ className = "" }: { className?: string }) {
  const deviceNodes = [
    { cx: 50, cy: 80, label: "" },
    { cx: 210, cy: 80, label: "" },
    { cx: 40, cy: 180, label: "" },
    { cx: 220, cy: 180, label: "" },
    { cx: 130, cy: 240, label: "" },
  ];

  return (
    <svg viewBox="0 0 260 260" fill="none" className={className}>
      {/* House outline */}
      <motion.path
        d="M130 30 L230 100 L230 210 L30 210 L30 100 Z"
        stroke="#9333ea"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Door */}
      <motion.rect
        x="110"
        y="155"
        width="40"
        height="55"
        rx="2"
        stroke="#9333ea"
        strokeWidth="1.5"
        fill="#581c87"
        fillOpacity="0.3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      />

      {/* Circuit traces from house center to device nodes */}
      {deviceNodes.map((node, i) => (
        <motion.line
          key={i}
          x1="130"
          y1="140"
          x2={node.cx}
          y2={node.cy}
          stroke="#9333ea"
          strokeWidth="1"
          strokeDasharray="4 3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 1.2 + i * 0.15 }}
        />
      ))}

      {/* Device nodes */}
      {deviceNodes.map((node, i) => (
        <motion.g key={`dn-${i}`}>
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="10"
            fill="#12121c"
            stroke="#9333ea"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 1.5 + i * 0.1 }}
          />
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="4"
            fill="#a855f7"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
          />
        </motion.g>
      ))}

      {/* Central hub inside house */}
      <motion.circle
        cx="130"
        cy="120"
        r="16"
        fill="#581c87"
        stroke="#9333ea"
        strokeWidth="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.6 }}
      />
      <motion.circle
        cx="130"
        cy="120"
        r="7"
        fill="#a855f7"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />

      {/* Pulse from central hub */}
      <motion.circle
        cx="130"
        cy="120"
        r="16"
        fill="none"
        stroke="#a855f7"
        strokeWidth="1"
        initial={{ r: 16, opacity: 0.5 }}
        animate={{ r: 50, opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
    </svg>
  );
}
