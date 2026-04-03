# SentinelDesk Frontend

React + Vite frontend for SentinelDesk.

## Run

- Install workspace deps from monorepo root:

```bash
npm install
```

- Start frontend dev server:

```bash
npm run dev --workspace frontend
```

- Build:

```bash
npm run build --workspace frontend
```

## Test

- Vitest (unit + integration):

```bash
npm run test --workspace frontend
```

- Playwright E2E:

```bash
npm run test:e2e --workspace frontend
```

- Install Playwright Chromium once (recommended for CI image/bootstrap):

```bash
npm run test:e2e:install --workspace frontend
```

- CI runner mode:

```bash
npm run test:e2e:ci --workspace frontend
```

- Playwright headed mode:

```bash
npm run test:e2e:headed --workspace frontend
```

If Playwright browsers are not installed yet:

```bash
npx playwright install
```

After browser binaries are installed/cached on the machine, E2E runs do not require external network access.

## Critical Route Expectations

- Unauthenticated users are redirected to `/login` for protected routes.
- Permission-protected routes enforce `session.permissions` at route level.
- Unauthorized deep-links are redirected to the nearest allowed route:
  - editor routes require `stories.review`
  - transactions route requires `transactions.read`
  - admin route requires `admin.manage`
  - audit route requires `audit.read`
  - alerts route requires `alerts.read`
- `admin.manage` acts as an override for protected route access.

## Security Behavior

- CSRF token is kept in memory only (not persisted in storage).
- On session restore, the app fetches `/auth/me` then rotates CSRF via `/auth/csrf`.
- Logout clears session and CSRF state.
- User/role switches force protected shell remount to avoid stale protected UI state.
- Browser E2E includes user-switch isolation coverage to prevent prior-user state leakage.

## Troubleshooting

- **`Network error: unable to reach API`**
  - Confirm backend is running and `VITE_API_BASE_URL` is correct.

- **Route keeps redirecting**
  - Confirm logged-in role has required permissions for that route.

- **CSRF errors on state-changing calls**
  - Re-authenticate and ensure cookies are enabled.

- **E2E fails to launch browser**
  - Run `npx playwright install`.

- **Port conflicts**
  - Stop existing Vite processes or adjust ports in Playwright config.
