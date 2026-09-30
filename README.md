# Rune

Talk to a live AWS architecture diagram.

Rune is a frameless native HUD (`⌘⇧J` to show, `Esc` to hide). Type what you are building. Jev classifies the graph, hangs official AWS architecture icons onto the right path, and follow-up prompts edit the diagram you already have — cache, replicas, queues, workers — without wiping the board.

## Demo

[![Rune demo](docs/rune-poster.png)](docs/rune-demo.mp4)

<video src="docs/rune-demo.mp4" poster="docs/rune-poster.png" width="100%" controls muted playsinline></video>

## Run

```bash
npm install
npm run desktop
```

Vite-only: `npm run dev` → http://127.0.0.1:1420

Put `VITE_TYPESAFE_API_KEY` in `.env` so compiles can call Jev. The HUD will not invent a full design without it.

## How it works

The HUD stays on top of your desktop. Search is always focused: type a service name and matching tiles lift out of the falling catalog; click one to stamp it on the board. Hover a tile for its name. Click a node on the diagram to select it — that box becomes the attach point for the next prompt, and the inspector shows what it is.

**Talk to an empty board.** Describe a system in English (`SaaS API with auth`, `event pipeline for clickstream`, `search over a product catalog`). Jev picks a topology, maps roles onto AWS services, and Dagre lays it out. You get Client → edge/gateway → services → data, with official icons, not a blank grid.

**Talk to the graph you already have.** Follow-ups do not start over. Jev decides whether each extra from a recipe belongs (skip a CDN on a service-level speedup; keep Redis on the path you named). Then it hangs what it kept on the right producer. Typical moves:

- Make a path faster — cache lookup + read replicas on the selected service, not a random hop
- Move slow work off the request — queue and workers as a side branch
- Tighten the public edge — WAF / CloudFront stay on Client → Gateway, never in the middle of Order → Payment
- Add search, async jobs, or a write pipeline as an overlay, inject, split, or bridge instead of duplicating the whole mesh

**Edit by name when you do not want Jev.** `Add Route 53`, `connect it to the API gateway`, `group app and database`, `color the database orange`, undo, reset. Drag nodes; positions stick. Multi-step prompts (`Add IAM, then connect to Auth`) run in order.

The catalog is Matter.js physics behind the glass. Patterns and intents are recipes; Jev is the classifier that chooses which recipe and where each new box lands.

## Stack

Tauri v2, React, TypeScript, Dagre, Matter.js, official AWS architecture icons, Jev (`@typesafe-ai/sdk`) via a Tauri proxy.
