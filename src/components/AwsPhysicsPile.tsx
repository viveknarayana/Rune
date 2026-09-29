import { useLayoutEffect, useRef } from "react";
import Matter from "matter-js";
import { AWS_SERVICES, type AwsService } from "../lib/aws-catalog";

const TILE = 56;
const ICON = 34;
const HIT = 32;
const FLY = "transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)";
const Z_FALL = "1";
const Z_MAGNET = "8";
const { Engine, Bodies, Composite, Body } = Matter;
const STEP = 1000 / 60;
const HALF = TILE / 2;

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
    const frame = containerRef.current?.getBoundingClientRect();
    if (!frame) return null;
    const px = clientX - frame.left;
    const py = clientY - frame.top;
    let best: string | null = null;
    let bestDist = HIT * HIT;
    for (const [id, pose] of visualRef.current) {
      const dx = pose.x - px;
      const dy = pose.y - py;
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

    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.x = 0;
    engine.gravity.y = 0.95;
    engine.positionIterations = 6;
    engine.velocityIterations = 4;

    const syncWalls = (width: number, height: number) => {
      wallsRef.current.forEach((wall) => Composite.remove(engine.world, wall));
      const floor = Bodies.rectangle(width / 2, height + 4, width * 2, 56, {
        isStatic: true,
        friction: 2,
        frictionStatic: 2,
        restitution: 0,
      });
      const wallH = height * 8;
      const slick = { isStatic: true, friction: 0.035, frictionStatic: 0.02, restitution: 0 };
      const left = Bodies.rectangle(-18, height / 2, 36, wallH, slick);
      const right = Bodies.rectangle(width + 18, height / 2, 36, wallH, slick);
      wallsRef.current = [floor, left, right];
      Composite.add(engine.world, wallsRef.current);
    };

    const spawn = (width: number) => {
      bodiesRef.current.forEach((body) => Composite.remove(engine.world, body));
      bodiesRef.current.clear();
      visualRef.current.clear();
      parkedRef.current.clear();
      AWS_SERVICES.forEach((service) => {
        const x = 48 + Math.random() * Math.max(80, width - 96);
        const y = -80 - Math.random() * 520 - Math.random() * Math.random() * 380;
        const body = Bodies.rectangle(x, y, 52, 52, {
          restitution: 0.02,
          friction: 0.28 + Math.random() * 0.12,
          frictionStatic: 0.2,
          frictionAir: 0.008 + Math.random() * 0.016,
          density: 0.0018 + Math.random() * 0.0016,
          angle: (Math.random() - 0.5) * 0.55,
          sleepThreshold: 28,
          chamfer: { radius: 10 },
        });
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 1.4,
          y: 0.2 + Math.random() * 4.2,
        });
        bodiesRef.current.set(service.id, body);
        visualRef.current.set(service.id, { x, y, a: body.angle });
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

    const prevPos = new Map<string, Pose>();
    let lastTs = performance.now();
    let accumulator = 0;

    const writeTransform = (node: HTMLElement, x: number, y: number, a: number) => {
      node.style.transform = `translate3d(${x - HALF}px, ${y - HALF}px, 0) rotate(${a}rad)`;
    };

    const rescueBody = (body: Matter.Body, width: number, height: number) => {
      let x = body.position.x;
      let y = body.position.y;
      const restY = height - 50;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(body.angle)) {
        Body.setPosition(body, { x: width * 0.5, y: restY });
        Body.setAngle(body, 0);
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
        return true;
      }
      if (body.velocity.y > 14) {
        Body.setVelocity(body, { x: body.velocity.x * 0.85, y: 14 });
      }
      if (Math.abs(body.velocity.x) > 8) {
        Body.setVelocity(body, {
          x: Math.sign(body.velocity.x) * 8,
          y: body.velocity.y,
        });
      }

      let escaped = false;
      if (x < -HALF) {
        x = HALF + 2;
        escaped = true;
      } else if (x > width + HALF) {
        x = width - HALF - 2;
        escaped = true;
      }
      if (y > height + HALF) {
        y = restY;
        escaped = true;
      }
      if (escaped) {
        Body.setPosition(body, { x, y });
        Body.setVelocity(body, { x: 0, y: Math.max(0, Math.min(body.velocity.y, 6)) });
        Body.setAngularVelocity(body, 0);
        if (body.isSleeping) Body.set(body, { isSleeping: false });
      }
      return escaped;
    };

    const paintFly = (id: string, pose: Pose, z: string, delay: number) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      node.style.transition = FLY;
      node.style.transitionDelay = `${delay}ms`;
      node.style.zIndex = z;
      writeTransform(node, pose.x, pose.y, pose.a);
    };

    let lastHover: string | null = null;
    let lastHeld: string | null = null;
    let lastSearch = false;
    let lastActiveKey = "";
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

      if (!searching) {
        const now = performance.now();
        let frameDt = now - lastTs;
        lastTs = now;
        if (frameDt > 32) frameDt = 32;
        accumulator += frameDt;
        let stepped = false;
        while (accumulator >= STEP) {
          for (const [id, body] of bodiesRef.current) {
            if (active.has(id) || body.isStatic) continue;
            prevPos.set(id, {
              x: body.position.x,
              y: body.position.y,
              a: body.angle,
            });
          }
          Engine.update(engine, STEP);
          for (const [id, body] of bodiesRef.current) {
            if (active.has(id) || body.isStatic) continue;
            if (rescueBody(body, w, h)) {
              prevPos.set(id, {
                x: body.position.x,
                y: body.position.y,
                a: body.angle,
              });
            }
          }
          accumulator -= STEP;
          stepped = true;
        }
        const alpha = stepped ? accumulator / STEP : 1;
        for (const [id, body] of bodiesRef.current) {
          if (active.has(id) || body.isStatic) continue;
          if (body.isSleeping && !stepped) continue;
          const node = nodesRef.current.get(id);
          if (!node) continue;
          const prev = prevPos.get(id);
          const x = prev ? prev.x + (body.position.x - prev.x) * alpha : body.position.x;
          const y = prev ? prev.y + (body.position.y - prev.y) * alpha : body.position.y;
          const a = prev ? prev.a + (body.angle - prev.a) * alpha : body.angle;
          if (node.style.transition !== "none") {
            node.style.transition = "none";
            node.style.transitionDelay = "0ms";
          }
          writeTransform(node, x, y, a);
          visualRef.current.set(id, { x, y, a });
          parkedRef.current.set(id, {
            x: body.position.x,
            y: body.position.y,
            a: body.angle,
          });
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
          const body = bodiesRef.current.get(service.id);
          if (!node) return;
          const magnet = active.has(service.id);
          if (magnet) {
            if (body && !body.isStatic) {
              parkedRef.current.set(service.id, {
                x: body.position.x,
                y: body.position.y,
                a: body.angle,
              });
              Body.setStatic(body, true);
            }
            const slot = Math.max(0, slots.indexOf(service.id));
            const pose = {
              x: originX + (slot % cols) * (TILE + gap),
              y: originY + Math.floor(slot / cols) * (TILE + 18),
              a: 0,
            };
            visualRef.current.set(service.id, pose);
            node.classList.add("is-magnet");
            paintFly(service.id, pose, Z_MAGNET, slot * 28);
          } else {
            node.classList.remove("is-magnet");
            if (body?.isStatic) Body.setStatic(body, false);
            const home =
              parkedRef.current.get(service.id) ??
              (body
                ? { x: body.position.x, y: body.position.y, a: body.angle }
                : undefined);
            if (home) {
              visualRef.current.set(service.id, home);
              paintFly(service.id, home, Z_FALL, 0);
            }
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
            className="pointer-events-none absolute top-0 left-0 rounded-2xl border bg-black/70 p-2"
            style={{
              width: TILE,
              height: TILE,
              borderColor: `${CATEGORY_COLOR[service.category]}66`,
              zIndex: 1,
              transformOrigin: "center center",
              transform: `translate3d(${40 + (index * 47) % 400}px, ${-90 - (index % 13) * 55}px, 0)`,
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
