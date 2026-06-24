"use client";

import { cn } from "../lib/utils";
import { useRef, useState, useEffect } from "react";

interface GlowingEffectProps {
  spread?: number;
  variant?: string;
  glow?: boolean;
  className?: string;
  movementDuration?: number;
}
export function GlowingEffect({
  spread = 20,
  variant = "default",
  glow = false,
  className,
  movementDuration = 2,
}: GlowingEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const variantStyles: Record<string, string> = {
    default:
      "bg-gradient-to-br from-slate-400/50 via-transparent to-slate-400/20",
    blue: "bg-gradient-to-br from-blue-500/50 via-transparent to-blue-400/20",
    purple: "bg-gradient-to-br from-purple-500/50 via-transparent to-purple-400/20",
    "blue-purple":
      "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500/20",
  };

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute -inset-px", className)}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300",
          glow && "opacity-100"
        )}
        style={{
          background: `radial-gradient(${spread}px circle at ${position.x}px ${position.y}px, rgba(139, 92, 246, 0.15), transparent 80%)`,
          opacity: glow ? 1 : opacity,
          transition: `opacity 0.3s ease, background ${movementDuration}s ease`,
        }}
      />
      <div
        className={cn(
          "absolute inset-[0.5px] rounded-[inherit] opacity-0 transition-opacity duration-300",
          variantStyles[variant] || variantStyles.default
        )}
        style={{
          opacity: glow ? 0.4 : opacity * 0.3,
          maskImage: `radial-gradient(${spread * 1.5}px circle at ${position.x}px ${position.y}px, black, transparent 80%)`,
          WebkitMaskImage: `radial-gradient(${spread * 1.5}px circle at ${position.x}px ${position.y}px, black, transparent 80%)`,
        }}
      />
    </div>
  );
}
