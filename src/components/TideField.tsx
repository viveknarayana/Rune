import { motion, useReducedMotion } from "framer-motion";
import haze from "../assets/violet-haze.jpg";

interface TideFieldProps {
  variant?: "idle" | "rail";
}

export function TideField({ variant = "idle" }: TideFieldProps) {
  const idle = variant === "idle";
  const reduceMotion = useReducedMotion();

  return (
    <div className="tide-field pointer-events-none absolute inset-0 overflow-hidden bg-[#090612]" aria-hidden>
      <motion.img
        src={haze}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: idle ? "58% 42%" : "72% 38%",
          filter: idle
            ? "saturate(1.08) contrast(1.06) brightness(1.04)"
            : "saturate(0.92) contrast(1.05) brightness(0.72)",
        }}
        initial={false}
        animate={
          reduceMotion
            ? { scale: 1.08, x: "0%", y: "0%" }
            : { scale: 1.1, x: ["0%", "0.6%"], y: ["0%", "-0.35%"] }
        }
        transition={
          reduceMotion
            ? { duration: 0.8 }
            : {
                duration: 56,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }
        }
      />
      <div className={idle ? "tide-scrim-idle" : "tide-scrim-rail"} />
    </div>
  );
}
