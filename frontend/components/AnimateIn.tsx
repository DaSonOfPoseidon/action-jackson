"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";

type VariantType = "fade-up" | "fade-in" | "blur-in" | "scale-in" | "slide-right";

interface AnimateInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: VariantType;
  stagger?: number;
}

const variants: Record<VariantType, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-in": {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  "blur-in": {
    hidden: { opacity: 0, filter: "blur(8px)" },
    visible: { opacity: 1, filter: "blur(0px)" },
  },
  "scale-in": {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
  },
  "slide-right": {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0 },
  },
};

export function AnimateIn({
  children,
  className = "",
  delay = 0,
  variant = "fade-up",
  stagger,
}: AnimateInProps) {
  const v = variants[variant];

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={v}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 20,
        delay: delay / 1000,
        ...(stagger ? { staggerChildren: stagger / 1000 } : {}),
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
