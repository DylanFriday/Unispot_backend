# UniSpot Backend (Next.js App Router)

## Base URL
- `http://localhost:3000`

## Auth
- Protected routes use: `Authorization: Bearer <token>`

## Common Error Shape
```json
{
  "statusCode": 500,
  "message": "Internal Server Error",
  "requestId": "c2c08393-2f3e-4706-aa2f-34252f5ea140"
}
```
- Many `4xx` responses also include:
```json
{
  "error": "Bad Request"
}
```
- `x-request-id` is returned in response headers for tracing logs.

## Health
- `GET /api/health`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`

## Me / Profile
- `GET /me`
- `PATCH /me`
- `PATCH /me/password`
- `GET /me/wallet`

## Dashboards
- `GET /dashboard/summary` (STUDENT)
- `GET /admin/dashboard/summary` (ADMIN)

## Courses
- `GET /courses`
- `POST /courses` (STUDENT)

## Teachers
- `GET /courses/:id/teachers`
- `POST /courses/:id/teachers` (ADMIN)

## Study Sheets
- `POST /study-sheets` (STUDENT)
- `GET /study-sheets`
- `GET /study-sheets/mine` (STUDENT)
- `GET /study-sheets/purchased` (STUDENT)
- `POST /study-sheets/:id/purchase` (STUDENT)
- `PATCH /study-sheets/:id` (STUDENT owner)
- `DELETE /study-sheets/:id` (STUDENT owner)

## Study Sheet Moderation
- `GET /moderation/study-sheets?status=PENDING|APPROVED|REJECTED` (STAFF/ADMIN)
- `POST /moderation/study-sheets/:id/approve` (STAFF/ADMIN)
- `POST /moderation/study-sheets/:id/reject` (STAFF/ADMIN)
- App Router dynamic param is `[id]` and handlers read `params.id`.

## Admin Payments
- `GET /admin/payments?status=PENDING|APPROVED|RELEASED` (ADMIN)
- `POST /admin/payments/:id/confirm` (ADMIN)
- `POST /admin/payments/:id/release` (ADMIN)

## Lease Listings
- `GET /lease-listings`
- `GET /lease-listings/mine` (STUDENT)
- `POST /lease-listings` (STUDENT)
- `PATCH /lease-listings/:id` (STUDENT owner)
- `DELETE /lease-listings/:id` (STUDENT owner)

## Lease Moderation
- `GET /moderation/lease-listings?status=PENDING|APPROVED|REJECTED` (STAFF/ADMIN)
- `POST /moderation/lease-listings/:id/approve` (STAFF/ADMIN)
- `POST /moderation/lease-listings/:id/reject` (STAFF/ADMIN)

## Course Reviews
- `GET /courses/:id/reviews`
- `POST /reviews` (STUDENT)
- `PATCH /reviews/:id` (STUDENT owner)
- `DELETE /reviews/:id` (STUDENT owner)
- `POST /reviews/:id/report` (STUDENT, creates `reports` record; duplicate pending report returns `200 Already reported`)
- `POST /reviews/:id/upvote` (STUDENT)
- `DELETE /reviews/:id/upvote` (STUDENT)

## Review Moderation
- `GET /moderation/reviews?status=VISIBLE|UNDER_REVIEW|REMOVED` (STAFF/ADMIN)
- `POST /moderation/reviews/:id/approve` (STAFF/ADMIN)
- `POST /moderation/reviews/:id/remove` (STAFF/ADMIN)

## Teacher Reviews
- `GET /courses/:id/teacher-reviews` (public, optional JWT)
- `GET /courses/:id/teachers/:teacherId/reviews` (public)
- `POST /teacher-reviews` (STUDENT)
- `PATCH /teacher-reviews/:id` (STUDENT owner)
- `DELETE /teacher-reviews/:id` (STUDENT owner)
- `POST /teacher-reviews/:id/report` (STUDENT, creates `reports` record; duplicate pending report returns `200 Already reported`)
- `POST /teacher-reviews/:id/upvote` (STUDENT)
- `DELETE /teacher-reviews/:id/upvote` (STUDENT)

## Teacher Review Moderation
- `GET /moderation/teacher-reviews?status=VISIBLE|UNDER_REVIEW|REMOVED` (STAFF/ADMIN)
- `POST /moderation/teacher-reviews/:id/approve` (STAFF/ADMIN)
- `POST /moderation/teacher-reviews/:id/remove` (STAFF/ADMIN)

## Admin Reports
- `GET /admin/reports?status=PENDING|RESOLVED|REJECTED` (ADMIN, defaults to `PENDING`)
- `PATCH /admin/reports/:id/status` (ADMIN, body: `{ "status": "RESOLVED" | "REJECTED" }`)
- `POST /admin/reports/:id/remove-target` (ADMIN, deletes target and resolves report)
- `PATCH /admin/reports/:id/status` only updates report status; it does not modify or delete the target review.
- Student-facing review visibility is unchanged by report status. Reviews disappear only when the target is removed/deleted (for example via `remove-target`).

## Withdrawals
- `POST /withdrawals` (STUDENT)
- `GET /withdrawals/mine` (STUDENT)
- `GET /withdrawals?status=PENDING|APPROVED|REJECTED` (ADMIN)
- `POST /withdrawals/:id/approve` (ADMIN)
- `POST /withdrawals/:id/reject` (ADMIN)

## Environment Variables
- `MONGODB_URI`
- `JWT_SECRET` (required in production for protected `/api/*` middleware auth)
- `PROMPTPAY_PHONE`
- `CORS_ORIGINS` (comma-separated allowlist, e.g. `http://localhost:5173,http://127.0.0.1:5173`)
- `CORS_ORIGIN` (legacy single-origin fallback, optional)

## API Prefix Notes
- Route handlers are defined under `src/app/*` (for example `/moderation/study-sheets/:id/approve`).
- If you call endpoints as `/api/...`, ensure your ingress/proxy rewrites `/api/*` to app routes.
- Health route is explicitly `/api/health`.

## Troubleshooting
- If you get `500` with transaction failures, use `requestId` from response and inspect logs:
```bash
docker logs Backend_unispot 2>&1 | rg "<requestId>"
```
- Transaction logs include structured fields: `requestId`, `route`, `errorName`, `errorMessage`, `errorStack`, `errorCode`, and `cause`.

## Default Test Accounts (Local Dev)
- Admin
  - Email: `admin@unispot.local`
  - Password: `Admin@12345`
- Staff
  - Email: `staff@unispot.local`
  - Password: `Staff@12345`
- Notes
  - These accounts exist only in your current MongoDB instance.
  - Change passwords before using outside local development.

## Run Locally
```bash
npm install
npm run dev
```

## Create DB Indexes
```bash
npm run db:indexes
```
