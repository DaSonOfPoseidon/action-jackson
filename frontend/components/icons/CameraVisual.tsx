"use client";

import { motion } from "framer-motion";

export function CameraVisual({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 260" fill="none" className={className}>
      {/* Outer ring */}
      <motion.circle
        cx="130"
        cy="130"
        r="100"
        stroke="#ea580c"
        strokeWidth="2"
        strokeDasharray="628"
        initial={{ strokeDashoffset: 628 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Concentric rings */}
      {[80, 60, 40].map((r, i) => (
        <motion.circle
          key={r}
          cx="130"
          cy="130"
          r={r}
          stroke="#ea580c"
          strokeWidth="1"
          fill="none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.3 + i * 0.1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 + i * 0.2 }}
        />
      ))}

      {/* Lens center */}
      <motion.circle
        cx="130"
        cy="130"
        r="18"
        fill="#9a3412"
        stroke="#ea580c"
        strokeWidth="2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.8 }}
      />
      <motion.circle
        cx="130"
        cy="130"
        r="8"
        fill="#ea580c"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />

      {/* Viewfinder brackets - top-left */}
      <motion.path
        d="M50 70 L50 50 L70 50"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 0.5, delay: 1.2 }}
      />
      {/* top-right */}
      <motion.path
        d="M190 50 L210 50 L210 70"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 0.5, delay: 1.3 }}
      />
      {/* bottom-right */}
      <motion.path
        d="M210 190 L210 210 L190 210"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 0.5, delay: 1.4 }}
      />
      {/* bottom-left */}
      <motion.path
        d="M70 210 L50 210 L50 190"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      />

      {/* Scanning beam */}
      <motion.rect
        x="50"
        y="126"
        width="160"
        height="8"
        rx="4"
        fill="url(#scanGradient)"
        initial={{ x: -160 }}
        animate={{ x: [50, 210, 50] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        opacity="0.3"
      />

      {/* Recording dot */}
      <motion.circle
        cx="200"
        cy="55"
        r="5"
        fill="#ef4444"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      <defs>
        <linearGradient id="scanGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0" />
          <stop offset="50%" stopColor="#ea580c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
