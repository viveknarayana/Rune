import { useLayoutEffect, useRef } from "react";
import Matter from "matter-js";
import { AWS_SERVICES, type AwsService } from "../lib/aws-catalog";

const TILE = 56;
const ICON = 34;
const HIT = 32;
const FLY = "transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)";
const Z_FALL = "1";
const Z_MAGNET = "8";
const Z_HELD = "10";
const { Engine, Bodies, Composite, Body } = Matter;

const CATEGORY_COLOR: Record<AwsService["category"], string> = {
  Compute: "#FF9900",
  Database: "#3B48CC",
  Storage: "#7AA116",
  Networking: "#8C4FFF",
  Security: "#DD344C",
  Integration: "#E7157B",
  Analytics: "#8C4FFF",
  AI: "#01A88D",
  Management: "#E7157B",
  Frontend: "#DD344C",
};

interface Pose {
  x: number;
  y: number;
  a: number;
}

interface AwsPhysicsPileProps {
  activeIds: string[];
  magnetTop?: number;
  onPick: (service: AwsService) => void;
}

export function AwsPhysicsPile({
  activeIds,
  magnetTop = 280,
  onPick,
}: AwsPhysicsPileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef(new Map<string, Matter.Body>());
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const visualRef = useRef(new Map<string, Pose>());
  const parkedRef = useRef(new Map<string, Pose>());
  const hoverRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const spawnedRef = useRef(false);
  const wallsRef = useRef<Matter.Body[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  const magnetTopRef = useRef(magnetTop);
  const activeListRef = useRef<string[]>([]);
  pickRef.current = onPick;
  magnetTopRef.current = magnetTop;
  activeListRef.current = activeIds;

  const hitDom = (clientX: number, clientY: number) => {
    let best: string | null = null;
    let bestDist = HIT * HIT;
    for (const [id, node] of nodesRef.current) {
      const box = node.getBoundingClientRect();
      const dx = box.left + box.width / 2 - clientX;
      const dy = box.top + box.height / 2 - clientY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    return best;
  };

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const engine = Engine.create();
    engine.enableSleeping = true;
    engine.gravity.x = 0;
    engine.gravity.y = 1.78;
    engine.positionIterations = 6;
    engine.velocityIterations = 4;
    engine.constraintIterations = 1;

    const syncWalls = (width: number, height: number) => {
      wallsRef.current.forEach((wall) => Composite.remove(engine.world, wall));
      const floor = Bodies.rectangle(width / 2, height + 10, width * 2, 40, {
        isStatic: true,
        friction: 2,
        frictionStatic: 2,
        restitution: 0,
      });
      const wallH = height * 8;
      const left = Bodies.rectangle(-18, height / 2, 36, wallH, { isStatic: true });
      const right = Bodies.rectangle(width + 18, height / 2, 36, wallH, {
        isStatic: true,
      });
      wallsRef.current = [floor, left, right];
      Composite.add(engine.world, wallsRef.current);
    };

    const spawn = (width: number, height: number) => {
      bodiesRef.current.forEach((body) => Composite.remove(engine.world, body));
      bodiesRef.current.clear();
      visualRef.current.clear();
      parkedRef.current.clear();
      const spread = Math.max(220, height * 0.9);
      AWS_SERVICES.forEach((service) => {
        const x = 36 + Math.random() * Math.max(40, width - 72);
        const y = -TILE - 16 - Math.random() * spread - Math.random() * Math.random() * 280;
        const body = Bodies.rectangle(x, y, TILE - 12, TILE - 12, {
          restitution: 0.02,
          friction: 1.2,
          frictionStatic: 1.4,
          frictionAir: 0.032 + Math.random() * 0.035,
          density: 0.0026 + Math.random() * 0.0012,
          angle: (Math.random() - 0.5) * 0.4,
          sleepThreshold: 10,
        });
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 1.1,
          y: 3.4 + Math.random() * 6.2,
        });
        bodiesRef.current.set(service.id, body);
        const pose = { x, y, a: body.angle };
        visualRef.current.set(service.id, pose);
        parkedRef.current.set(service.id, { ...pose });
        Composite.add(engine.world, body);
      });
      spawnedRef.current = true;
    };

    const sized = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width < 80 || height < 80) return false;
      sizeRef.current = { w: width, h: height };
      syncWalls(width, height);
      if (!spawnedRef.current) spawn(width, height);
      return true;
    };

    let tries = 0;
    const boot = () => {
      if (sized() || tries > 48) return;
      tries += 1;
      requestAnimationFrame(boot);
    };
    boot();

    const ro = new ResizeObserver(() => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width < 80 || height < 80) return;
      const prev = sizeRef.current;
      if (spawnedRef.current && Math.abs(prev.w - width) < 8 && Math.abs(prev.h - height) < 8) {
        return;
      }
      sizeRef.current = { w: width, h: height };
      syncWalls(width, height);
      if (!spawnedRef.current) spawn(width, height);
    });
    ro.observe(root);

    const paint = (id: string, pose: Pose, z: string, flying: boolean, delay = 0) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      node.style.transition = flying ? FLY : "none";
      node.style.transitionDelay = flying ? `${delay}ms` : "0ms";
      node.style.transform = `translate3d(${pose.x - TILE / 2}px, ${pose.y - TILE / 2}px, 0) rotate(${pose.a}rad)`;
      node.style.zIndex = z;
    };

    const STEP = 1000 / 60;
    const prevPos = new Map<string, Pose>();
    let physicsLive = true;
    let still = 0;
    let lastHover: string | null = null;
    let lastHeld: string | null = null;
    let lastSearch = false;
    let lastActiveKey = "";
    let lastTs = performance.now();
    let accumulator = 0;
    let frame = 0;

    const tick = () => {
      const { w, h } = sizeRef.current;
      const slots = activeListRef.current;
      const active = new Set(slots);
      const searching = slots.length > 0;
      const gap = 20;
      const inset = 36;
      const cols = Math.max(
        1,
        Math.min(
          slots.length || 1,
          Math.floor((Math.max(TILE, w - inset * 2) + gap) / (TILE + gap)),
        ),
      );
      const gridW = cols * TILE + Math.max(0, cols - 1) * gap;
      const originX = (w - gridW) / 2 + TILE / 2;
      const originY = Math.min(
        Math.max(h - TILE, TILE),
        Math.max(magnetTopRef.current, 160) + TILE / 2 + 18,
      );
      const hover = hoverRef.current;

      if (searching !== lastSearch) {
        root.classList.toggle("pile-searching", searching);
        lastSearch = searching;
      }

      if (physicsLive && !searching) {
        const now = performance.now();
        let frameDt = now - lastTs;
        lastTs = now;
        if (frameDt > 48) frameDt = 48;
        accumulator += frameDt;
        let moving = false;
        let steps = 0;
        while (accumulator >= STEP && steps < 2) {
          for (const [id, body] of bodiesRef.current) {
            prevPos.set(id, {
              x: body.position.x,
              y: body.position.y,
              a: body.angle,
            });
          }
          Engine.update(engine, STEP);
          for (const [, body] of bodiesRef.current) {
            const speed = Math.abs(body.velocity.x) + Math.abs(body.velocity.y);
            const spin = Math.abs(body.angularVelocity);
            const nearFloor = body.position.y > h - TILE * 2.4;
            if (nearFloor && speed < 0.1 && spin < 0.012) {
              Body.setVelocity(body, { x: 0, y: 0 });
              Body.setAngularVelocity(body, 0);
            } else {
              moving = true;
            }
          }
          accumulator -= STEP;
          steps += 1;
        }
        const alpha = Math.min(1, accumulator / STEP);
        for (const [id, body] of bodiesRef.current) {
          const prev = prevPos.get(id);
          const pose = prev
            ? {
                x: prev.x + (body.position.x - prev.x) * alpha,
                y: prev.y + (body.position.y - prev.y) * alpha,
                a: prev.a + (body.angle - prev.a) * alpha,
              }
            : { x: body.position.x, y: body.position.y, a: body.angle };
          visualRef.current.set(id, pose);
          parkedRef.current.set(id, {
            x: body.position.x,
            y: body.position.y,
            a: body.angle,
          });
          paint(id, pose, hover === id ? Z_HELD : Z_FALL, false);
        }
        if (steps > 0) {
          still = moving ? 0 : still + 1;
          if (still > 18) physicsLive = false;
        }
      } else {
        lastTs = performance.now();
        accumulator = 0;
      }

      const activeKey = `${slots.join("\0")}|${cols}|${Math.round(originX)}|${Math.round(originY / 8)}`;
      if (activeKey !== lastActiveKey) {
        lastActiveKey = activeKey;
        AWS_SERVICES.forEach((service) => {
          const node = nodesRef.current.get(service.id);
          if (!node) return;
          const magnet = active.has(service.id);
          if (magnet) {
            const slot = Math.max(0, slots.indexOf(service.id));
            const pose = {
              x: originX + (slot % cols) * (TILE + gap),
              y: originY + Math.floor(slot / cols) * (TILE + 18),
              a: 0,
            };
            visualRef.current.set(service.id, pose);
            node.classList.add("is-magnet");
            paint(service.id, pose, Z_MAGNET, true, slot * 28);
          } else {
            const home = parkedRef.current.get(service.id);
            if (home) visualRef.current.set(service.id, home);
            node.classList.remove("is-magnet");
            if (home) paint(service.id, home, Z_FALL, true);
          }
        });
      }

      if (hover !== lastHeld) {
        if (lastHeld) nodesRef.current.get(lastHeld)?.classList.remove("is-held");
        if (hover) nodesRef.current.get(hover)?.classList.add("is-held");
        lastHeld = hover;
      }

      const tip = tipRef.current;
      if (tip) {
        if (hover) {
          const service = AWS_SERVICES.find((item) => item.id === hover);
          const node = nodesRef.current.get(hover);
          if (service && node) {
            if (lastHover !== hover) {
              tip.replaceChildren();
              const name = document.createElement("span");
              name.textContent = service.label;
              const cat = document.createElement("span");
              cat.textContent = service.category;
              tip.append(name, cat);
              lastHover = hover;
            }
            const box = node.getBoundingClientRect();
            const frame = root.getBoundingClientRect();
            const x = box.left + box.width / 2 - frame.left;
            const y = box.top - frame.top;
            const below = searching || y < 140;
            const tipTop = below
              ? Math.min(h - 44, y + box.height + 10)
              : Math.max(12, y - 10);
            tip.style.opacity = "1";
            tip.style.left = `${Math.min(w - 16, Math.max(16, x))}px`;
            tip.style.top = `${tipTop}px`;
            tip.style.transform = below
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)";
          }
        } else if (lastHover !== null) {
          tip.style.opacity = "0";
          lastHover = null;
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      spawnedRef.current = false;
      Engine.clear(engine);
      wallsRef.current = [];
    };
  }, []);

  const activeCount = activeIds.length;

  return (
    <div className="relative h-full min-h-0 w-full">
      <div
        ref={containerRef}
        className="pile-canvas no-drag absolute inset-0 z-0 cursor-pointer overflow-hidden"
        onPointerMove={(event) => {
          hoverRef.current = hitDom(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          hoverRef.current = null;
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          const id = hoverRef.current ?? hitDom(event.clientX, event.clientY);
          const service = AWS_SERVICES.find((item) => item.id === id);
          if (service) pickRef.current(service);
        }}
      >
        {AWS_SERVICES.map((service, index) => (
          <button
            key={service.id}
            type="button"
            title={`${service.label} · ${service.category}`}
            ref={(node) => {
              if (node) nodesRef.current.set(service.id, node);
              else nodesRef.current.delete(service.id);
            }}
            tabIndex={-1}
            className="pointer-events-none absolute top-0 left-0 rounded-2xl border bg-black/70 p-2 shadow-[0_10px_22px_rgba(0,0,0,0.45)]"
            style={{
              width: TILE,
              height: TILE,
              borderColor: `${CATEGORY_COLOR[service.category]}66`,
              zIndex: 1,
              transform: `translate3d(${24 + (index % 11) * 70}px, ${-TILE - (index % 17) * 36 - (index % 5) * 80}px, 0)`,
            }}
          >
            <span className="tile-face pointer-events-none flex h-full w-full items-center justify-center">
            <img
              src={service.icon}
              alt=""
              width={ICON}
              height={ICON}
              className="pointer-events-none h-[34px] w-[34px] object-contain"
              draggable={false}
            />
            </span>
          </button>
        ))}
      </div>
      <div
        ref={tipRef}
        className="pointer-events-none absolute z-30 flex flex-col items-center rounded-md border border-white/16 bg-[#120814]/94 px-2 py-1 font-mono text-[11px] tracking-tight whitespace-nowrap text-sky-50 shadow-[0_10px_24px_rgba(0,0,0,0.45)] opacity-0 backdrop-blur-md [&>span:last-child]:text-[9px] [&>span:last-child]:tracking-[0.14em] [&>span:last-child]:text-sky-100/45 [&>span:last-child]:uppercase"
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-sky-100/40">
          {activeCount ? "Active stack" : "Catalog"}
        </p>
        <p className="font-mono text-[10px] tracking-tight text-sky-100/35">
          {activeCount ? `${activeCount} magnetized` : `${AWS_SERVICES.length} services`}
        </p>
      </div>
    </div>
  );
}
