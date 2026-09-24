import { AnimatePresence, motion } from "framer-motion";
import type { AwsService } from "../lib/aws-catalog";
import { ServiceIcon } from "./ServiceIcon";

interface ServiceStackProps {
  services: AwsService[];
  query: string;
  jevBoosted?: boolean;
  expanded?: boolean;
  onPick: (service: AwsService) => void;
}

export function ServiceStack({
  services,
  query,
  jevBoosted,
  expanded,
  onPick,
}: ServiceStackProps) {
  const searching = Boolean(query.trim());
  const lifted = searching
    ? services.slice(0, expanded ? 10 : 6)
    : services.slice(0, expanded ? 12 : 8);

  return (
    <div className={`no-drag ${expanded ? "min-h-0 flex-1" : ""}`}>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">
          AWS index{searching ? ` · ${lifted.length} up` : " · stack"}
        </p>
        {jevBoosted && (
          <span className="font-mono text-[10px] text-emerald-300/80">
            Jev ranked
          </span>
        )}
      </div>
      <div
        className={
          expanded
            ? "relative flex min-h-[180px] flex-wrap content-start items-start gap-2 overflow-auto pb-1"
            : "relative flex h-[92px] items-end gap-2 overflow-hidden"
        }
      >
        <AnimatePresence mode="popLayout">
          {lifted.map((service, index) => {
            const active = Boolean(query.trim());
            return (
              <motion.button
                key={service.id}
                layout
                type="button"
                onClick={() => onPick(service)}
                initial={{ y: 28, opacity: 0, rotate: -6 }}
                animate={{
                  y: expanded || active ? 0 : Math.min(index, 4) * 4,
                  opacity: 1,
                  rotate: expanded || active ? 0 : index % 2 === 0 ? -4 : 3,
                  scale: active && index === 0 ? 1.04 : 1,
                  zIndex: 20 - index,
                }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border border-white/12 bg-zinc-950/85 px-1.5 py-2 shadow-lg backdrop-blur-xl hover:border-white/40"
                title={`${service.label} · ${service.category}`}
              >
                <ServiceIcon src={service.icon} label={service.short} size={28} />
                <span className="w-full truncate text-center text-[9px] font-medium text-white/85">
                  {service.short}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
