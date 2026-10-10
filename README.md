# Friendship App — Backend

API for the Friendship mobile app (`../friendship-mobile-app`), written in TypeScript.

- **NestJS 12** (Express), **PostgreSQL**, **Drizzle ORM** for the schema, migrations and queries
- **Firebase Authentication**: the app signs in with Firebase, and the API verifies Firebase ID tokens
- **Swagger UI** at `/docs`, and the OpenAPI JSON at `/docs/openapi.json`
- **Socket.IO** for realtime chat events, and **Expo push** notifications for offline users

## Requirements

- Node.js **24.21.0** (`nvm use` reads `.nvmrc`). `package.json` requires `>=24.21.0 <25`, and `.npmrc` sets `engine-strict`, so `npm install` refuses other versions.
- PostgreSQL 14 or newer
- A Firebase project with the sign-in methods you need: Phone, Google, Apple

## Getting started

```bash
nvm use
npm install
cp .env.example .env        # then fill in DATABASE_URL and the FIREBASE_* values
createdb friendship_app
npm run db:migrate
npm run db:seed             # coin packs, Pro plans, demo profiles, community posts
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

## Scripts

| Script | What it does |
| --- | --- |
| `start:dev` | Runs with watch mode |
| `build` / `start` | Compiles to `dist/` and runs the compiled app |
| `typecheck` | `tsc --noEmit` |
| `db:generate` | Creates a SQL migration in `drizzle/` from changes to `src/database/schema` |
| `db:migrate` | Applies pending migrations |
| `db:seed` | Idempotent seed: catalog plus demo data |
| `db:reset` | **Development only.** Drops everything, then migrates and seeds |
| `db:studio` | Opens Drizzle Studio |

To change the database: edit `src/database/schema/*.ts`, run `npm run db:generate`, review the SQL it creates, then run `npm run db:migrate`.

## Authentication (Firebase)

The backend never handles OTPs or passwords. Firebase does that on the device.

1. The app signs in with the Firebase SDK (phone OTP, Google or Apple).
2. On every request it sends `Authorization: Bearer <Firebase ID token>`. Get the token with `user.getIdToken()`; the SDK refreshes it automatically.
3. Right after sign-in, the app calls `POST /api/v1/auth/session`. This creates the account the first time (with the signup coin bonus) and returns `{ isNewUser, user }`. Use `user.onboardingCompleted` to decide whether to show onboarding.

The global `FirebaseAuthGuard` verifies the token with `firebase-admin` and maps the Firebase `uid` to our `users` row. Routes marked `@Public()` skip it: `/auth/session` (which does its own verification), `/meta/options` and `/health`.

| Env var | Needed for |
| --- | --- |
| `FIREBASE_PROJECT_ID` | **Required.** Token verification only needs this. |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Optional service account. Without it, account deletion can't delete the Firebase user, and `POST /auth/sign-out-everywhere` returns 503. You can set `GOOGLE_APPLICATION_CREDENTIALS` instead. |
| `FIREBASE_CHECK_REVOKED` | Also rejects revoked sessions. Costs one network call per request. |

Socket.IO uses the same token: `io('<host>/realtime', { auth: { token: idToken } })`.

## API overview

All routes are under `/api/v1`. Swagger has the full request and response schemas.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/session`, `POST /auth/sign-out-everywhere` |
| Profile | `GET/PATCH/DELETE /users/me`, `POST /users/me/onboarding/complete`, `PUT /users/me/avatar`, `GET /users/me/avatar/items`, `POST /users/me/photos` (multipart), `DELETE /users/me/photos/:id`, `POST /users/me/verification` (selfie, multipart), `GET /users/:id` |
| Discover | `GET /discover` (filters: `all/new/online/nearby/verified`, gender, distance, age; height/city/bio length are Pro-only), `GET /discover/spotlight` |
| Likes & safety | `GET /likes/sent`, `GET /likes/received`, `POST/DELETE /likes/:userId`, `GET /blocks`, `POST/DELETE /blocks/:userId`, `POST /reports` |
| Chats | `GET/POST /chats`, `GET/DELETE /chats/:id`, `GET/POST /chats/:id/messages`, `POST /chats/:id/gifts`, `POST /chats/:id/read` |
| Quick match | `GET /quick-match/current`, `POST /quick-match`, `GET /quick-match/:id`, `POST /quick-match/:id/cancel`, `POST /quick-match/:id/decision` |
| Wallet | `GET /wallet`, `GET /wallet/transactions`, `GET /wallet/packs`, `POST /wallet/purchases` |
| Pro | `GET /subscriptions/plans`, `GET /subscriptions/me`, `GET /subscriptions/me/history`, `POST /subscriptions`, `POST /subscriptions/me/cancel` |
| Community | `GET/POST /posts`, `GET/DELETE /posts/:id`, `POST/DELETE /posts/:id/like`, `GET/POST /posts/:id/comments`, `DELETE /posts/:id/comments/:commentId` |
| Devices | `POST /devices`, `POST /devices/unregister` (Expo push tokens) |
| Meta | `GET /meta/options`: picker lists, limits and prices, so the app and server stay in sync |
| Admin | Everything under `/admin`, used by the admin portal. See [Admin API](#admin-api). |

### Errors

Every error has the same shape:

```json
{ "statusCode": 402, "code": "INSUFFICIENT_COINS", "message": "Not enough coins", "details": { "needed": 50, "balance": 20 } }
```

Branch on `code`. The ones the UI cares about:

- `INSUFFICIENT_COINS` (402): open the coins screen
- `CHAT_CAPACITY_REACHED` and `PRO_REQUIRED` (403): show the Pro upsell
- `ONBOARDING_INCOMPLETE` (403/400): `details.missing` lists the fields still needed
- `CHAT_CLOSED`, `CHAT_EXPIRED`, `USER_BLOCKED`, `QUICK_MATCH_IN_PROGRESS`, `QUICK_MATCH_NOT_FINISHED`

### Realtime events (`/realtime` namespace)

| Event | Payload |
| --- | --- |
| `message.new` | `MessageDto` (`mine` is computed for the recipient) |
| `chat.read` | `{ chatId, userId, readAt }`: the other person read the chat |
| `chat.closed` | `{ chatId }` |
| `chat.typing` | `{ chatId, userId }` (the client sends `typing { chatId }`) |
| `wallet.updated` | `{ coins }` |
| `quickMatch.updated` | `QuickMatchDto`: paired, a decision was made, or the result is in |

## Admin API

The admin portal (`../friendship-app-admin`) uses the routes under `/api/v1/admin`. The code is in `src/modules/admin`.

- **Separate accounts.** Admins live in the `admin_users` table, not `users`. They sign in with email and password (`POST /admin/auth/login`, scrypt-hashed) and get a signed HS256 token. Firebase tokens don't work on admin routes, and admin tokens don't work on app routes.
- **First admin.** Run `npm run admin:create -- --email you@example.com --name "Your Name" --password '<10+ chars>'`, which creates a `super_admin` by default. Running it again for the same email resets the password and re-enables the account.
- **Roles.** `moderator`: dashboard, users, verifications, reports, community. `admin`: also coin adjustments, Pro changes, account deletion, catalog, billing and the audit log. `super_admin`: also manages admin accounts. Set per route with `@MinRole()`.
- **Revocation.** Each token carries `admin_users.token_version`. Changing the password, resetting it, deactivating the account or calling `POST /admin/auth/sign-out-everywhere` bumps the version, which ends existing sessions right away.
- **Audit log.** Every admin write adds a row to `admin_audit_logs` in the same transaction (`GET /admin/audit-logs`).
- **Suspension.** `POST /admin/users/:id/suspend` sets `users.suspended_at`. The user's sockets are closed, their Firebase sessions are revoked when a service account is configured, they are hidden from other people, and every request they make fails with `403 ACCOUNT_SUSPENDED`.

| Env var | Purpose |
| --- | --- |
| `ADMIN_JWT_SECRET` | Signs admin tokens. **Required in production** (32+ characters, e.g. `openssl rand -base64 48`). In development a random secret is used if it's empty, so admins are signed out on restart. |
| `ADMIN_TOKEN_TTL_HOURS` | Admin session length, default 12 |

| Area | Endpoints |
| --- | --- |
| Auth | `POST /admin/auth/login`, `GET /admin/auth/me`, `POST /admin/auth/change-password`, `POST /admin/auth/sign-out-everywhere` |
| Dashboard | `GET /admin/dashboard` |
| Users | `GET /admin/users`, `GET/DELETE /admin/users/:id`, `POST /admin/users/:id/suspend`, `POST /admin/users/:id/unsuspend`, `POST /admin/users/:id/coins`, `PUT /admin/users/:id/pro` |
| Verifications | `GET /admin/verifications`, `POST /admin/verifications/:id/review` |
| Reports | `GET /admin/reports`, `POST /admin/reports/:id/resolve` |
| Community | `GET /admin/posts`, `GET/PATCH/DELETE /admin/posts/:id`, `POST /admin/posts/:id/restore`, `GET /admin/posts/:id/comments`, `DELETE /admin/posts/:id/comments/:commentId` |
| Catalog | `GET/POST /admin/catalog/coin-packs`, `PATCH /admin/catalog/coin-packs/:id`, `GET/POST /admin/catalog/pro-plans`, `PATCH /admin/catalog/pro-plans/:id` |
| Billing | `GET /admin/billing/payments`, `GET /admin/billing/subscriptions`, `GET /admin/billing/transactions` |
| Admins | `GET/POST /admin/admins`, `PATCH/DELETE /admin/admins/:id` |
| Audit | `GET /admin/audit-logs` |

Admin lists take `page` (1-based), `pageSize` (up to 100) and `search`, and return `{ items, total, page, pageSize }`.

## Product rules (configurable in `.env`)

- New accounts get `SIGNUP_BONUS_COINS` (139).
- Free users can have `FREE_CHAT_CAPACITY` (3) open friend chats. Pro users have no limit.
- A quick match costs `QUICK_MATCH_COST` (50) coins, which are refunded if you leave the queue before being paired. Chatting lasts `QUICK_MATCH_DURATION_SECONDS` (300). After that, both people choose keep or pass within 10 minutes; anyone who doesn't choose counts as pass. If both keep, the quick chat becomes a permanent friend chat with its history.
- Premium avatar options cost `AVATAR_PREMIUM_COST` (50) coins each and are bought automatically when the avatar is saved.
- Photos of another user unlock once the two of you have an open chat.
- Coin balances only change through `WalletLedgerService`, which writes a matching row to `coin_transactions` in the same transaction. A database check constraint keeps balances from going negative.

## Project layout

```
src/
  main.ts, app.setup.ts     bootstrap; prefix, CORS, helmet, static uploads, Swagger
  app.module.ts             global validation pipe, exception filter, throttling
  config/                   zod-validated environment (fails fast at boot)
  database/
    schema/                 Drizzle tables, enums, indexes, check constraints
    scripts/                migrate / seed / reset
  common/                   errors, decorators (@Public, @CurrentUser), pagination, catalog lists
  modules/
    auth/ firebase/         Firebase token verification, user provisioning
    admin/                  back office API for the admin portal (own auth, roles, audit log)
    users/ people/          own profile, public profiles (one SQL query builds every PersonDto)
    discover/ social/       feed, likes, blocks, reports
    chats/ quick-match/     messaging, gifts, receipts, timed matches
    wallet/ payments/ subscriptions/   coin ledger, store purchases, Pro
    community/              posts, likes, comments
    realtime/ notifications/ devices/  Socket.IO, presence, Expo push
    storage/                uploads (local disk)
drizzle/                    generated SQL migrations
```

Request and response DTOs live in each module's `dto/*.dto.ts`. The `@nestjs/swagger` CLI plugin reads these files, so their types, `class-validator` rules and JSDoc comments appear in Swagger without extra decorators.

## Before going to production

These are deliberately stubbed or development-only:

- **Store receipts**: `PaymentVerifierService` only accepts the `test` provider, which is disabled when `ALLOW_TEST_PAYMENTS=false`. `app_store` and `play_store` return 503 until validation is wired to the App Store Server API and the Google Play Developer API.
- **Selfie verification**: `VERIFICATION_AUTO_APPROVE=true` approves immediately. In production, requests stay `pending` until someone reviews them in the admin portal (`POST /admin/verifications/:id/review`).
- **File storage**: uploads go to local disk (`UPLOAD_DIR`) and are served from `/uploads`. Replace `StorageService` with S3/GCS before running more than one instance.
- **Scaling sockets**: presence is in memory. With several instances, add the Socket.IO Redis adapter and move presence to Redis.
- The app refuses to boot in production if any development-only flag is still on.
