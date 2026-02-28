import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

// Mock framer-motion — renders children without animation in jsdom
// Cache components to maintain stable references across renders
const motionComponentCache = new Map<string | symbol, React.ForwardRefExoticComponent<Record<string, unknown>>>();

function getMotionComponent(tag: string | symbol) {
  if (!motionComponentCache.has(tag)) {
    const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(
      (props, ref) => {
        // Strip all framer-motion-specific props before passing to DOM
        const {
          initial: _initial,
          animate: _animate,
          exit: _exit,
          variants: _variants,
          transition: _transition,
          whileInView: _whileInView,
          whileHover: _whileHover,
          whileTap: _whileTap,
          viewport: _viewport,
          layout: _layout,
          layoutId: _layoutId,
          onAnimationComplete: _onAnimationComplete,
          ...rest
        } = props;
        return React.createElement(tag as string, { ...rest, ref });
      }
    );
    Component.displayName = `motion.${String(tag)}`;
    motionComponentCache.set(tag, Component);
  }
  return motionComponentCache.get(tag)!;
}

const motion = new Proxy(
  {},
  {
    get: (_target, prop) => getMotionComponent(prop),
  }
);

vi.mock("framer-motion", () => ({
  motion,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({
    start: vi.fn(),
    set: vi.fn(),
    stop: vi.fn(),
  }),
  useInView: () => true,
  useMotionValue: (initial: number) => ({
    get: () => initial,
    set: vi.fn(),
    onChange: vi.fn(),
  }),
  useTransform: (_value: unknown, _inputRange: number[], outputRange: number[]) => ({
    get: () => outputRange[0],
    set: vi.fn(),
    onChange: vi.fn(),
  }),
}));

// Mock IntersectionObserver for jsdom (still needed for any non-framer usage)
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private callback: IntersectionObserverCallback) {
    setTimeout(() => {
      this.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    }, 0);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
