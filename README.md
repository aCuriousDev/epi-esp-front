# Frontend for DNDiscord project

SolidJS/TypeScript frontend running as a Discord Activity (iframe). Uses BabylonJS for 3D rendering.

## Setup

```sh
cd dndiscord-esp
npm install
```

## Dev

```sh
npm run dev              # Vite dev server on localhost:3000
npm run dev:tunnel       # Cloudflare tunnel for Discord Activity testing
```

## Build

```sh
npm run build            # typecheck + vite build
npm run typecheck        # tsc only
```

## CI/CD

- **CI**: GitHub Actions (`.github/workflows/ci.yml`) -- typecheck + build on push/PR to `main` and `dev`
- **CD**: Dokploy auto-deploy via GitHub App on push to configured branches
- **Cross-platform note**: `package-lock.json` generated on Windows lacks Linux-specific rollup binaries. CI uses `rm -f package-lock.json && npm install` as workaround. Dockerfile copies only `package.json` (not lockfile) for the same reason.
