import { useLayoutEffect, useRef } from "react";
import Matter from "matter-js";
import { AWS_SERVICES, type AwsService } from "../lib/aws-catalog";

const TILE = 48;
const LERP = 0.16;
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
  onPick: (service: AwsService) => void;
}

export function AwsPhysicsPile({ activeIds, onPick }: AwsPhysicsPileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef(new Map<string, Matter.Body>());
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const visualRef = useRef(new Map<string, Pose>());
  const parkedRef = useRef(new Map<string, Pose>());
  const activeRef = useRef(new Set<string>());
  const hoverRef = useRef<string | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const spawnedRef = useRef(false);
  const wallsRef = useRef<Matter.Body[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  activeRef.current = new Set(activeIds);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const engine = Engine.create();
    engine.enableSleeping = true;
    engine.gravity.x = 0;
    engine.gravity.y = 1.1;
    engine.positionIterations = 4;
    engine.velocityIterations = 3;
    engine.constraintIterations = 1;

    const syncWalls = (width: number, height: number) => {
      wallsRef.current.forEach((wall) => Composite.remove(engine.world, wall));
      const floor = Bodies.rectangle(width / 2, height + 10, width * 2, 40, {
        isStatic: true,
        friction: 1.2,
        restitution: 0.06,
      });
      const left = Bodies.rectangle(-18, height / 2, 36, height * 4, { isStatic: true });
      const right = Bodies.rectangle(width + 18, height / 2, 36, height * 4, {
        isStatic: true,
      });
      wallsRef.current = [floor, left, right];
      Composite.add(engine.world, wallsRef.current);
    };

    const spawn = (width: number) => {
      bodiesRef.current.forEach((body) => Composite.remove(engine.world, body));
      bodiesRef.current.clear();
      visualRef.current.clear();
      parkedRef.current.clear();
      const cols = Math.max(6, Math.floor(width / 58));
      AWS_SERVICES.forEach((service, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 28 + col * ((width - 56) / Math.max(1, cols - 1));
        const y = 28 + (row % 4) * 22 + Math.random() * 18;
        const body = Bodies.rectangle(x, y, TILE - 10, TILE - 10, {
          restitution: 0.16,
          friction: 0.85,
          frictionAir: 0.05,
          density: 0.002,
          angle: (Math.random() - 0.5) * 0.5,
          sleepThreshold: 18,
        });
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 0.8,
          y: 1.2 + Math.random() * 0.6,
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
      if (!spawnedRef.current) spawn(width);
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
      if (!spawnedRef.current) spawn(width);
    });
    ro.observe(root);

    const hitAt = (x: number, y: number) => {
      let best: string | null = null;
      let bestDist = 30 * 30;
      for (const [id, pose] of visualRef.current) {
        const dx = pose.x - x;
        const dy = pose.y - y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = id;
        }
      }
      return best;
    };

    const paint = (id: string, pose: Pose, scale: number, z: string) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      node.style.transform = `translate3d(${pose.x - TILE / 2}px, ${pose.y - TILE / 2}px, 0) rotate(${pose.a}rad) scale(${scale})`;
      node.style.zIndex = z;
    };

    let physicsLive = true;
    let still = 0;
    let lastHover: string | null = null;
    let lastSearch = false;
    let frame = 0;

    const tick = () => {
      const { w, h } = sizeRef.current;
      const active = activeRef.current;
      const searching = active.size > 0;
      const slots = [...active];
      const cols = Math.min(6, Math.max(1, slots.length));
      const gap = 14;
      const originX = w / 2 - (cols * TILE + (cols - 1) * gap) / 2 + TILE / 2;
      const pointer = pointerRef.current;
      hoverRef.current = pointer ? hitAt(pointer.x, pointer.y) : null;
      const hover = hoverRef.current;

      if (searching !== lastSearch) {
        root.classList.toggle("pile-searching", searching);
        lastSearch = searching;
      }

      if (physicsLive && !searching) {
        Engine.update(engine, 1000 / 60);
        let moving = false;
        for (const [id, body] of bodiesRef.current) {
          const pose = { x: body.position.x, y: body.position.y, a: body.angle };
          visualRef.current.set(id, pose);
          parkedRef.current.set(id, pose);
          if (
            !body.isSleeping &&
            Math.abs(body.velocity.x) + Math.abs(body.velocity.y) > 0.12
          ) {
            moving = true;
          }
        }
        still = moving ? 0 : still + 1;
        if (still > 24) physicsLive = false;
      }

      for (const service of AWS_SERVICES) {
        const magnet = active.has(service.id);
        const held = hover === service.id;
        const node = nodesRef.current.get(service.id);
        let pose = visualRef.current.get(service.id);
        if (!pose || !node) continue;

        if (magnet) {
          const slot = Math.max(0, slots.indexOf(service.id));
          const tx = originX + (slot % cols) * (TILE + gap);
          const ty = 40 + Math.floor(slot / cols) * (TILE + 16);
          pose = {
            x: pose.x + (tx - pose.x) * LERP,
            y: pose.y + (ty - pose.y) * LERP,
            a: pose.a * 0.78,
          };
          visualRef.current.set(service.id, pose);
          node.classList.add("is-magnet");
          paint(service.id, pose, held ? 1.16 : 1.08, held ? "50" : "30");
        } else {
          const home = parkedRef.current.get(service.id) ?? pose;
          const dx = home.x - pose.x;
          const dy = home.y - pose.y;
          if (dx * dx + dy * dy > 0.4 || Math.abs(home.a - pose.a) > 0.01) {
            pose = {
              x: pose.x + dx * LERP,
              y: pose.y + dy * LERP,
              a: pose.a + (home.a - pose.a) * LERP,
            };
            visualRef.current.set(service.id, pose);
          } else if (pose !== home) {
            pose = home;
            visualRef.current.set(service.id, pose);
          }
          node.classList.remove("is-magnet");
          paint(service.id, pose, held ? 1.18 : 1, held ? "50" : "12");
        }
        node.classList.toggle("is-held", held);
      }

      const tip = tipRef.current;
      if (tip) {
        if (hover) {
          const service = AWS_SERVICES.find((item) => item.id === hover);
          const pose = visualRef.current.get(hover);
          if (service && pose) {
            if (lastHover !== hover) {
              tip.replaceChildren();
              const name = document.createElement("span");
              name.textContent = service.label;
              const cat = document.createElement("span");
              cat.textContent = service.category;
              tip.append(name, cat);
              lastHover = hover;
            }
            const below = pose.y < 56;
            tip.style.opacity = "1";
            tip.style.left = `${Math.min(w - 12, Math.max(12, pose.x))}px`;
            tip.style.top = `${
              below
                ? Math.min(h - 8, pose.y + TILE / 2 + 8)
                : Math.max(8, pose.y - TILE / 2 - 8)
            }px`;
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex shrink-0 items-center justify-between px-0.5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-sky-100/40">
          {activeCount ? "Active stack" : "Catalog"}
        </p>
        <p className="font-mono text-[10px] tracking-tight text-sky-100/35">
          {activeCount ? `${activeCount} magnetized` : `${AWS_SERVICES.length} services`}
        </p>
      </div>
      <div
        ref={containerRef}
        className="pile-canvas no-drag relative isolate z-20 min-h-[260px] w-full flex-1 cursor-pointer overflow-hidden rounded-xl"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointerRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
        }}
        onPointerLeave={() => {
          pointerRef.current = null;
          hoverRef.current = null;
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const id = hoverRef.current;
          const fallbackX = event.clientX - rect.left;
          const fallbackY = event.clientY - rect.top;
          let best: string | null = id;
          if (!best) {
            let bestDist = 30 * 30;
            for (const [key, pose] of visualRef.current) {
              const dx = pose.x - fallbackX;
              const dy = pose.y - fallbackY;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                best = key;
              }
            }
          }
          const service = AWS_SERVICES.find((item) => item.id === best);
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
            className="pointer-events-none absolute top-0 left-0 rounded-xl border bg-black/70 p-1.5 shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
            style={{
              width: TILE,
              height: TILE,
              borderColor: `${CATEGORY_COLOR[service.category]}66`,
              transform: `translate3d(${12 + (index % 7) * 56}px, ${16 + (index % 5) * 18}px, 0)`,
            }}
          >
            <img
              src={service.icon}
              alt=""
              width={30}
              height={30}
              className="pointer-events-none h-[30px] w-[30px] object-contain"
              draggable={false}
            />
          </button>
        ))}
        <div
          ref={tipRef}
          className="pointer-events-none absolute z-[60] flex flex-col items-center rounded-md border border-white/16 bg-[#120814]/94 px-2 py-1 font-mono text-[11px] tracking-tight whitespace-nowrap text-sky-50 shadow-[0_10px_24px_rgba(0,0,0,0.45)] opacity-0 backdrop-blur-md [&>span:last-child]:text-[9px] [&>span:last-child]:tracking-[0.14em] [&>span:last-child]:text-sky-100/45 [&>span:last-child]:uppercase"
        />
      </div>
    </div>
  );
}
