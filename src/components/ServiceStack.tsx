import { motion } from "framer-motion";
import type { AwsService } from "../lib/aws-catalog";
import { ServiceIcon } from "./ServiceIcon";

interface ServiceStackProps {
  services: AwsService[];
  query: string;
  jevBoosted?: boolean;
  expanded?: boolean;
  rail?: boolean;
  onPick: (service: AwsService) => void;
}

const spring = { type: "spring" as const, stiffness: 340, damping: 26, mass: 0.55 };

export function ServiceStack({
  services,
  query,
  jevBoosted,
  expanded,
  rail,
  onPick,
}: ServiceStackProps) {
  const searching = Boolean(query.trim());
  const lifted = searching
    ? services.slice(0, 36)
    : services.slice(0, expanded ? 12 : 10);
  const iconSize = rail ? 28 : searching ? 44 : 32;

  return (
    <div className={`no-drag flex min-h-0 flex-col ${expanded ? "flex-1" : ""}`}>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <motion.p
          key={searching ? "matches" : "catalog"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[10px] tracking-[0.18em] text-zinc-600 uppercase"
        >
          {searching ? `${lifted.length} matches` : "Catalog"}
        </motion.p>
        {jevBoosted && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-mono text-[10px] tracking-tight text-emerald-400"
          >
            Jev
          </motion.span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pr-0.5">
        <motion.div
          layout
          className={
            rail
              ? "grid grid-cols-3 gap-1"
              : searching
                ? "grid grid-cols-8 gap-2"
                : "grid grid-cols-5 gap-1.5"
          }
        >
          {lifted.map((service, index) => {
            const ranked = searching && index === 0 && jevBoosted;
            return (
              <motion.button
                key={service.id}
                layout
                type="button"
                onClick={() => onPick(service)}
                initial={{ opacity: 0, scale: 0.78, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  ...spring,
                  delay: Math.min(index, 20) * 0.02,
                }}
                whileHover={{
                  y: -4,
                  scale: 1.07,
                  transition: { type: "spring", stiffness: 420, damping: 22 },
                }}
                whileTap={{ scale: 0.95 }}
                className={`group flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 ${
                  ranked
                    ? "border-emerald-400/35 bg-emerald-400/5"
                    : "border-transparent hover:border-white/12 hover:bg-white/[0.04]"
                }`}
                title={`${service.label} · ${service.category}`}
              >
                <ServiceIcon
                  src={service.icon}
                  label={service.short}
                  size={iconSize}
                />
                <span className="w-full truncate text-center font-mono text-[10px] tracking-tight text-zinc-400 group-hover:text-zinc-100">
                  {service.short}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
