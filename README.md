# Prompt2Comp

Frameless Tauri overlay. `⌘⇧J` shows it; `Esc` hides it. The first view is the AWS picker — the drawing board appears after you add a service or compile a graph. Follow-up language mutates that graph in place.

```bash
npm install
npm run desktop
npm run dev          # http://127.0.0.1:1420
```

Set `VITE_TYPESAFE_API_KEY` in `.env` to call TypeSafe Jev.

## AWS index + stack

Common AWS services are indexed (compute, storage, data, networking, security, integration, analytics, AI). Logos load from the official-style `aws-icons` set. Typing in the bar **lifts matching tiles out of the stack**. Local fuzzy search is instant; Jev re-ranks the top candidates when a key is set. Click a tile to add that service to the canvas.

## Language

Generate a small core (only extras you name):

- `SaaS API with auth and a database`
- `High-volume payment checkout`
- `Distributed order and inventory services`

Mutate the current graph:

- `Add "Route 53"`
- `Add IAM component`
- `Add Redis before the database`
- `Remove the CDN`
- `Connect Route 53 to the API gateway`
- `Group app and database as VPC`
- `Square IAM and Identity`
- `Color the database orange`

### Multi-step

One prompt can run several mutations in order. Split with `then`, `and then`, `;`, a comma before the next verb, or `, and`:

- `Add IAM component, and connect to identity. Square IAM and Identity`
- `Add "Route 53" then connect to the API gateway`
- `Add a CDN before the gateway; color the CDN purple`
- `add ec2, group application service`

After an **add**, a later clause that says `connect to X` (no source) uses the node you just added. That is how `Add IAM, and connect to identity` links IAM → Identity / Auth.

This is a general pipeline, not a special case for IAM.

### Not yet: pronouns

`it` / `that` / `this` as a standalone sentence (`connect it to the database` after a pause) is not reliable yet. Say the component name, or keep the add and the connect in the **same** multi-step prompt so the last-added node is in scope.

Region/VPC frames, freeform boxes, and connect-X-to-Y are the first slice of an AWS-style canvas. Nested regions and richer icons come next.
