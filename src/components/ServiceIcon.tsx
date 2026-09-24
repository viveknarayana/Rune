import { useState } from "react";

interface ServiceIconProps {
  src?: string;
  label: string;
  size?: number;
}

export function ServiceIcon({ src, label, size = 28 }: ServiceIconProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className="grid place-items-center rounded-md bg-white/10 font-mono text-[10px] font-semibold text-white/80"
        style={{ width: size, height: size }}
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  );
}
