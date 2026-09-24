# Prompt2Comp

Raycast-style Tauri v2 overlay. `⌘⇧J` shows a frameless glass HUD. Jev compiles a system topology (or mutates the current graph); Dagre places nodes; Framer Motion draws the cards and Bézier arrows over the desktop.

## Run

```bash
npm install
npm run desktop    # Tauri v2 + Vite
npm run dev        # Vite-only preview at http://127.0.0.1:1420
```

Set `VITE_TYPESAFE_API_KEY` to call TypeSafe Jev. Without a key, the same Choice / Score / Noul schema is evaluated locally.

`Esc` hides the overlay.
