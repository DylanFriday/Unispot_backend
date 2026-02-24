# UniSpot Raw SQL by Route

This document maps each HTTP route to the exact SQL statements currently used in backend services.

Notes:
- `query(...)` = single statement execution.
- `transaction(async (client) => ...)` = `BEGIN/COMMIT/ROLLBACK` wrapper in `src/db/pg.ts`.
- Statements using `FOR UPDATE` are explicitly marked.
- Some update routes build dynamic `SET` clauses based on optional fields; base pattern is included.

## Auth

### POST `/auth/register`
```sql
SELECT * FROM "User" WHERE email = $1 LIMIT 1
```
```sql
INSERT INTO "User" (email, name, "passwordHash", "updatedAt") VALUES ($1, $2, $3, NOW()) RETURNING id, role
```

### POST `/auth/login`
```sql
SELECT * FROM "User" WHERE email = $1 LIMIT 1
```

### GET `/auth/me`
Calls same SQL as `GET /me`.

### PATCH `/auth/me`
Calls same SQL as `PATCH /me`.

---

## Me / Profile

### GET `/me`
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name IN ('avatarUrl', 'phone', 'bio')
```
Then (dynamic projection depending column existence):
```sql
SELECT
  id,
  email,
  role,
  name,
  name AS "fullName",
  "avatarUrl" OR NULL::text AS "avatarUrl",
  phone OR NULL::text AS phone,
  bio OR NULL::text AS bio,
  "createdAt",
  "updatedAt"
FROM "User"
WHERE id = $1
LIMIT 1
```

### PATCH `/me`
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name IN ('avatarUrl', 'phone', 'bio')
```
Then dynamic update:
```sql
UPDATE "User"
SET <dynamic set clauses>, "updatedAt" = NOW()
WHERE id = $N
RETURNING
  id,
  email,
  role,
  name,
  name AS "fullName",
  "avatarUrl" OR NULL::text AS "avatarUrl",
  phone OR NULL::text AS phone,
  bio OR NULL::text AS bio,
  "createdAt",
  "updatedAt"
```

### PATCH `/me/password`
```sql
SELECT id, "passwordHash" FROM "User" WHERE id = $1 LIMIT 1
```
```sql
UPDATE "User" SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2
```

### GET `/me/wallet`
```sql
SELECT "walletBalance" FROM "User" WHERE id = $1 LIMIT 1
```
```sql
SELECT
  COALESCE(SUM(CASE WHEN status = $2 THEN amount ELSE 0 END), 0) AS "totalEarned",
  COALESCE(SUM(CASE WHEN status = $3 THEN amount ELSE 0 END), 0) AS "pendingPayout"
FROM "Payment"
WHERE "sellerId" = $1
```

---

## Student Dashboard

### GET `/dashboard/summary`
```sql
SELECT "walletBalance" FROM "User" WHERE id = $1 LIMIT 1
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $2)::int AS pending,
  COUNT(*) FILTER (WHERE status = $3)::int AS approved,
  COUNT(*) FILTER (WHERE status = $4)::int AS rejected
FROM "StudySheet"
WHERE "ownerId" = $1
```
```sql
SELECT
  COUNT(*)::int AS "totalSalesCount",
  COALESCE(SUM(amount), 0)::int AS "totalSalesAmountCents",
  COALESCE(SUM(CASE WHEN status <> $2 THEN amount ELSE 0 END), 0)::int AS "pendingPayoutCents",
  COALESCE(SUM(CASE WHEN status = $3 THEN amount ELSE 0 END), 0)::int AS "releasedPayoutCents"
FROM "Payment"
WHERE "sellerId" = $1
```
```sql
SELECT
  COUNT(*)::int AS "totalPurchasesCount",
  COALESCE(SUM(amount), 0)::int AS "totalSpentCents"
FROM "Purchase"
WHERE "buyerId" = $1
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $2)::int AS pending,
  COUNT(*) FILTER (WHERE status = $3)::int AS approved,
  COUNT(*) FILTER (WHERE status = $4)::int AS rejected,
  COUNT(*) FILTER (WHERE status = $5)::int AS transferred
FROM "LeaseListing"
WHERE "ownerId" = $1
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $2)::int AS visible,
  COUNT(*) FILTER (WHERE status = $3)::int AS "underReview",
  COUNT(*) FILTER (WHERE status = $4)::int AS removed
FROM "Review"
WHERE "studentId" = $1
```

---

## Admin Dashboard

### GET `/admin/dashboard/summary`
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE role = $1)::int AS students,
  COUNT(*) FILTER (WHERE role = $2)::int AS staff,
  COUNT(*) FILTER (WHERE role = $3)::int AS admins
FROM "User"
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $1)::int AS pending,
  COUNT(*) FILTER (WHERE status = $2)::int AS approved,
  COUNT(*) FILTER (WHERE status = $3)::int AS rejected
FROM "StudySheet"
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $1)::int AS "pendingCount",
  COUNT(*) FILTER (WHERE status = $2)::int AS "approvedCount",
  COUNT(*) FILTER (WHERE status = $3)::int AS "releasedCount",
  COALESCE(SUM(amount), 0)::int AS "totalAmountCents",
  COALESCE(SUM(CASE WHEN status = $1 THEN amount ELSE 0 END), 0)::int AS "pendingAmountCents"
FROM "Payment"
```
```sql
SELECT
  (SELECT COUNT(*)::int FROM "StudySheet" WHERE status = $1) AS "studySheetsPending",
  (SELECT COUNT(*)::int FROM "LeaseListing" WHERE status = $2) AS "leasesPending",
  (SELECT COUNT(*)::int FROM "Review" WHERE status = $3) AS "reviewsUnderReview"
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $1)::int AS pending,
  COUNT(*) FILTER (WHERE status = $2)::int AS approved,
  COUNT(*) FILTER (WHERE status = $3)::int AS rejected,
  COUNT(*) FILTER (WHERE status = $4)::int AS transferred
FROM "LeaseListing"
```
```sql
SELECT
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE status = $1)::int AS visible,
  COUNT(*) FILTER (WHERE status = $2)::int AS "underReview",
  COUNT(*) FILTER (WHERE status = $3)::int AS removed
FROM "Review"
```
```sql
SELECT
  c.id AS "courseId",
  c.code,
  c.name,
  COUNT(r.id)::int AS "reviewCount",
  ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) AS "avgRating"
FROM "Course" c
JOIN "Review" r ON r."courseId" = c.id AND r.status = $1
GROUP BY c.id, c.code, c.name
ORDER BY "reviewCount" DESC, "avgRating" DESC
LIMIT 5
```

---

## Courses

### GET `/courses`
With search:
```sql
SELECT id, code, name FROM "Course" WHERE code ILIKE $1 OR name ILIKE $1 ORDER BY code ASC
```
Without search:
```sql
SELECT id, code, name FROM "Course" ORDER BY code ASC
```

### POST `/courses`
```sql
SELECT * FROM "Course" WHERE code = $1 LIMIT 1
```
```sql
INSERT INTO "Course" (code, name) VALUES ($1, $2) RETURNING *
```

---

## Teachers

### GET `/courses/:id/teachers`
```sql
SELECT t.id, t.name FROM "CourseTeacher" ct JOIN "Teacher" t ON ct."teacherId" = t.id WHERE ct."courseId" = $1 ORDER BY t.name ASC
```

### POST `/courses/:id/teachers`
```sql
SELECT id FROM "Course" WHERE id = $1
```
```sql
INSERT INTO "Teacher" (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = "Teacher".name RETURNING id, name
```
Transaction:
```sql
SELECT 1 FROM "CourseTeacher" WHERE "courseId" = $1 AND "teacherId" = $2 LIMIT 1
```
```sql
INSERT INTO "CourseTeacher" ("courseId", "teacherId") VALUES ($1, $2)
```

---

## Study Sheets

### POST `/study-sheets`
```sql
INSERT INTO "Course" (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = "Course".name RETURNING id
```
```sql
INSERT INTO "StudySheet" (title, description, "fileUrl", price, status, "courseId", "ownerId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *
```

### GET `/study-sheets`
With `courseCode`:
```sql
SELECT ss.*, c.code AS "courseCode" FROM "StudySheet" ss JOIN "Course" c ON ss."courseId" = c.id WHERE ss.status = $1 AND c.code = $2 ORDER BY ss."createdAt" DESC
```
Without filter:
```sql
SELECT ss.*, c.code AS "courseCode" FROM "StudySheet" ss JOIN "Course" c ON ss."courseId" = c.id WHERE ss.status = $1 ORDER BY ss."createdAt" DESC
```

### GET `/study-sheets/mine`
```sql
SELECT * FROM "StudySheet" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC
```

### GET `/study-sheets/purchased`
```sql
SELECT
  p.id AS "purchaseId",
  p."createdAt" AS "purchasedAt",
  p.amount AS "amountCents",
  ss.id AS "studySheetId",
  ss.title,
  ss.description,
  ss."fileUrl" AS "fileUrl",
  ss.price AS "priceCents",
  ss.status,
  ss."createdAt" AS "createdAt",
  ss."updatedAt" AS "updatedAt",
  ss."ownerId" AS "ownerId",
  ss."courseId" AS "courseId",
  c.code AS "courseCode"
FROM "Purchase" p
JOIN "StudySheet" ss ON ss.id = p."studySheetId"
JOIN "Course" c ON c.id = ss."courseId"
WHERE p."buyerId" = $1
ORDER BY p."createdAt" DESC
```

### POST `/study-sheets/:id/purchase`
```sql
SELECT id FROM "Payment" WHERE "referenceCode" = $1 LIMIT 1
```
Transaction:
```sql
SELECT * FROM "StudySheet" WHERE id = $1 FOR UPDATE
```
```sql
SELECT 1 FROM "Purchase" WHERE "studySheetId" = $1 AND "buyerId" = $2 LIMIT 1
```
```sql
INSERT INTO "Purchase" ("buyerId", "studySheetId", amount) VALUES ($1, $2, $3) RETURNING id
```
```sql
INSERT INTO "Payment" ("purchaseId", "referenceCode", amount, status, "buyerId", "sellerId", "studySheetId") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, "referenceCode" as reference_code, amount
```

### PATCH `/study-sheets/:id`
```sql
SELECT * FROM "StudySheet" WHERE id = $1
```
Dynamic update:
```sql
UPDATE "StudySheet" SET <dynamic set clauses>, "updatedAt" = NOW() WHERE id = $N RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```

### DELETE `/study-sheets/:id`
Transaction:
```sql
SELECT * FROM "StudySheet" WHERE id = $1 FOR UPDATE
```
```sql
SELECT COUNT(*) FROM "Purchase" WHERE "studySheetId" = $1
```
```sql
DELETE FROM "StudySheetApproval" WHERE "studySheetId" = $1
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```
```sql
DELETE FROM "StudySheet" WHERE id = $1 RETURNING *
```

---

## Study Sheet Moderation

### GET `/moderation/study-sheets`
```sql
SELECT * FROM "StudySheet" WHERE status = $1 ORDER BY "createdAt" ASC
```

### POST `/moderation/study-sheets/:id/approve`
Transaction:
```sql
SELECT * FROM "StudySheet" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "StudySheet" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
INSERT INTO "StudySheetApproval" ("studySheetId", "reviewerId", decision, reason) VALUES ($1, $2, $3, NULL) ON CONFLICT ("studySheetId") DO UPDATE SET "reviewerId" = EXCLUDED."reviewerId", decision = EXCLUDED.decision, reason = NULL
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```

### POST `/moderation/study-sheets/:id/reject`
Transaction:
```sql
SELECT * FROM "StudySheet" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "StudySheet" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
INSERT INTO "StudySheetApproval" ("studySheetId", "reviewerId", decision, reason) VALUES ($1, $2, $3, $4) ON CONFLICT ("studySheetId") DO UPDATE SET "reviewerId" = EXCLUDED."reviewerId", decision = EXCLUDED.decision, reason = EXCLUDED.reason
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```

---

## Admin Payments

### GET `/admin/payments`
```sql
SELECT id, "purchaseId", "referenceCode", amount, status, "approvedAt", "releasedAt", "approvedById", "releasedById", "buyerId", "sellerId", "studySheetId", "createdAt" FROM "Payment" WHERE status = $1 ORDER BY "createdAt" DESC
```

### POST `/admin/payments/:id/confirm`
Transaction:
```sql
SELECT * FROM "Payment" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "Payment" SET status = $1, "approvedAt" = NOW(), "approvedById" = $2 WHERE id = $3 RETURNING id, status, amount
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```

### POST `/admin/payments/:id/release`
Transaction:
```sql
SELECT * FROM "Payment" WHERE id = $1 FOR UPDATE
```
```sql
SELECT id FROM "User" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "Payment" SET status = $1, "releasedAt" = NOW(), "releasedById" = $2 WHERE id = $3 RETURNING id, status
```
```sql
UPDATE "User" SET "walletBalance" = "walletBalance" + $1 WHERE id = $2
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId", amount) VALUES ($1, $2, $3, $4, $5)
```

---

## Lease Listings

### GET `/lease-listings`
```sql
SELECT 1
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'LeaseListing'
  AND column_name = 'lineId'
LIMIT 1
```
Then one of:
```sql
SELECT id, title, description, "lineId", location, "rentCents", "depositCents", "startDate", "endDate", status, "createdAt", "updatedAt", "ownerId" FROM "LeaseListing" WHERE status = $1 ORDER BY "createdAt" DESC
```
or
```sql
SELECT id, title, description, NULL::text AS "lineId", location, "rentCents", "depositCents", "startDate", "endDate", status, "createdAt", "updatedAt", "ownerId" FROM "LeaseListing" WHERE status = $1 ORDER BY "createdAt" DESC
```

### GET `/lease-listings/mine`
Same `information_schema` check, then:
```sql
SELECT id, title, description, "lineId" OR NULL::text AS "lineId", location, "rentCents", "depositCents", "startDate", "endDate", status, "createdAt", "updatedAt", "ownerId" FROM "LeaseListing" WHERE "ownerId" = $1 ORDER BY "createdAt" DESC
```

### POST `/lease-listings`
Same `information_schema` check, then one of:
```sql
INSERT INTO "LeaseListing" (title, description, "lineId", location, "rentCents", "depositCents", "startDate", "endDate", status, "ownerId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *
```
or
```sql
INSERT INTO "LeaseListing" (title, description, location, "rentCents", "depositCents", "startDate", "endDate", status, "ownerId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *
```

### PATCH `/lease-listings/:id`
```sql
SELECT 1
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'LeaseListing'
  AND column_name = 'lineId'
LIMIT 1
```
```sql
SELECT * FROM "LeaseListing" WHERE id = $1
```
Dynamic:
```sql
UPDATE "LeaseListing" SET <dynamic set clauses>, "updatedAt" = NOW() WHERE id = $N RETURNING *
```

### DELETE `/lease-listings/:id`
```sql
SELECT * FROM "LeaseListing" WHERE id = $1
```
```sql
DELETE FROM "LeaseListing" WHERE id = $1 RETURNING *
```

### POST `/lease-listings/:id/interest`
```sql
SELECT * FROM "LeaseListing" WHERE id = $1
```
```sql
SELECT 1 FROM "InterestRequest" WHERE "leaseListingId" = $1 AND "studentId" = $2 LIMIT 1
```
```sql
INSERT INTO "InterestRequest" ("leaseListingId", "studentId") VALUES ($1, $2) RETURNING *
```

### POST `/lease-listings/:id/transfer`
Transaction:
```sql
SELECT * FROM "LeaseListing" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "LeaseListing" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

---

## Lease Moderation

### GET `/moderation/lease-listings`
```sql
SELECT * FROM "LeaseListing" WHERE status = $1 ORDER BY "createdAt" ASC
```

### POST `/moderation/lease-listings/:id/approve`
Transaction:
```sql
SELECT * FROM "LeaseListing" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "LeaseListing" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
DELETE FROM "LeaseApproval" WHERE "leaseListingId" = $1
```
```sql
INSERT INTO "LeaseApproval" ("leaseListingId", "reviewerId", decision) VALUES ($1, $2, $3)
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

### POST `/moderation/lease-listings/:id/reject`
Transaction:
```sql
SELECT * FROM "LeaseListing" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "LeaseListing" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
DELETE FROM "LeaseApproval" WHERE "leaseListingId" = $1
```
```sql
INSERT INTO "LeaseApproval" ("leaseListingId", "reviewerId", decision, reason) VALUES ($1, $2, $3, $4)
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

---

## Reviews

### GET `/courses/:id/reviews`
```sql
SELECT * FROM "Review" WHERE "courseId" = $1 AND status = $2 ORDER BY "createdAt" DESC
```

### POST `/reviews`
```sql
SELECT 1 FROM "Review" WHERE "studentId" = $1 AND "courseId" = $2 LIMIT 1
```
```sql
INSERT INTO "Review" (rating, text, status, "studentId", "courseId", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
```

### PATCH `/reviews/:id`
```sql
SELECT * FROM "Review" WHERE id = $1
```
Transaction:
```sql
INSERT INTO "ReviewHistory" ("reviewId", "oldRating", "oldText") VALUES ($1, $2, $3)
```
```sql
UPDATE "Review" SET rating = $1, text = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *
```

### DELETE `/reviews/:id`
```sql
SELECT * FROM "Review" WHERE id = $1
```
Transaction:
```sql
DELETE FROM "ReviewVote" WHERE "reviewId" = $1
```
```sql
DELETE FROM "ReviewReport" WHERE "reviewId" = $1
```
```sql
DELETE FROM "ReviewHistory" WHERE "reviewId" = $1
```
```sql
DELETE FROM "Review" WHERE id = $1 RETURNING *
```

### POST `/reviews/:id/report`
```sql
SELECT * FROM "Review" WHERE id = $1
```
```sql
SELECT 1 FROM "ReviewReport" WHERE "reviewId" = $1 AND "reporterId" = $2 LIMIT 1
```
Transaction:
```sql
INSERT INTO "ReviewReport" ("reviewId", "reporterId", reason) VALUES ($1, $2, $3) RETURNING *
```
```sql
UPDATE "Review" SET status = $1, "updatedAt" = NOW() WHERE id = $2
```

### POST `/reviews/:id/upvote`
```sql
SELECT * FROM "Review" WHERE id = $1
```
```sql
SELECT 1 FROM "ReviewVote" WHERE "reviewId" = $1 AND "voterId" = $2 LIMIT 1
```
```sql
INSERT INTO "ReviewVote" ("reviewId", "voterId") VALUES ($1, $2) RETURNING *
```

### DELETE `/reviews/:id/upvote`
```sql
DELETE FROM "ReviewVote" WHERE "reviewId" = $1 AND "voterId" = $2
```

---

## Review Moderation

### GET `/moderation/reviews`
```sql
SELECT * FROM "Review" WHERE status = $1 ORDER BY "createdAt" ASC
```

### POST `/moderation/reviews/:id/approve`
```sql
SELECT * FROM "Review" WHERE id = $1
```
```sql
UPDATE "Review" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

### POST `/moderation/reviews/:id/remove`
```sql
SELECT * FROM "Review" WHERE id = $1
```
```sql
UPDATE "Review" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

---

## Teacher Reviews

### GET `/courses/:courseId/teacher-reviews`
If studentId present:
```sql
SELECT * FROM "TeacherReview" WHERE "courseId" = $1 AND (status = $2 OR (status = $3 AND "studentId" = $4)) ORDER BY "createdAt" DESC
```
Else:
```sql
SELECT * FROM "TeacherReview" WHERE "courseId" = $1 AND status = $2 ORDER BY "createdAt" DESC
```

### GET `/courses/:courseId/teachers/:teacherId/reviews`
```sql
SELECT * FROM "TeacherReview" WHERE "courseId" = $1 AND "teacherId" = $2 AND status = $3 ORDER BY "createdAt" DESC
```

### POST `/teacher-reviews`
```sql
SELECT id FROM "Course" WHERE id = $1
```
```sql
SELECT 1 FROM "TeacherReview" WHERE "studentId" = $1 AND "courseId" = $2 AND "normalizedName" = $3 AND status IN ($4, $5) LIMIT 1
```
```sql
INSERT INTO "TeacherReview" ("studentId", "courseId", "teacherName", "normalizedName", rating, text, status, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *
```

### PATCH `/teacher-reviews/:id`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
Transaction:
```sql
INSERT INTO "TeacherReviewHistory" ("teacherReviewId", "oldRating", "oldText") VALUES ($1, $2, $3)
```
```sql
UPDATE "TeacherReview" SET rating = $1, text = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *
```

### DELETE `/teacher-reviews/:id`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
Transaction:
```sql
DELETE FROM "TeacherReviewVote" WHERE "teacherReviewId" = $1
```
```sql
DELETE FROM "TeacherReviewReport" WHERE "teacherReviewId" = $1
```
```sql
DELETE FROM "TeacherReviewHistory" WHERE "teacherReviewId" = $1
```
```sql
DELETE FROM "TeacherReview" WHERE id = $1 RETURNING *
```

### POST `/teacher-reviews/:id/report`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
```sql
SELECT 1 FROM "TeacherReviewReport" WHERE "teacherReviewId" = $1 AND "reporterId" = $2 LIMIT 1
```
Transaction:
```sql
INSERT INTO "TeacherReviewReport" ("teacherReviewId", "reporterId", reason) VALUES ($1, $2, $3) RETURNING *
```
```sql
UPDATE "TeacherReview" SET status = $1, "updatedAt" = NOW() WHERE id = $2
```

### POST `/teacher-reviews/:id/upvote`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
```sql
SELECT 1 FROM "TeacherReviewVote" WHERE "teacherReviewId" = $1 AND "voterId" = $2 LIMIT 1
```
```sql
INSERT INTO "TeacherReviewVote" ("teacherReviewId", "voterId") VALUES ($1, $2) RETURNING *
```

### DELETE `/teacher-reviews/:id/upvote`
```sql
DELETE FROM "TeacherReviewVote" WHERE "teacherReviewId" = $1 AND "voterId" = $2
```

---

## Teacher Review Moderation

### GET `/moderation/teacher-reviews`
```sql
SELECT * FROM "TeacherReview" WHERE status = $1 ORDER BY "createdAt" ASC
```

### POST `/moderation/teacher-reviews/:id/approve`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
Transaction:
```sql
INSERT INTO "Teacher" (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = "Teacher".name RETURNING id, name
```
```sql
SELECT 1 FROM "CourseTeacher" WHERE "courseId" = $1 AND "teacherId" = $2 LIMIT 1
```
```sql
INSERT INTO "CourseTeacher" ("courseId", "teacherId") VALUES ($1, $2)
```
```sql
UPDATE "TeacherReview" SET "teacherId" = $1, status = $2, "reviewedById" = $3, "reviewedAt" = NOW(), "decisionReason" = NULL, "updatedAt" = NOW() WHERE id = $4 RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

### POST `/moderation/teacher-reviews/:id/remove`
```sql
SELECT * FROM "TeacherReview" WHERE id = $1
```
```sql
UPDATE "TeacherReview" SET status = $1, "reviewedById" = $2, "reviewedAt" = NOW(), "decisionReason" = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING *
```
```sql
INSERT INTO "AuditLog" ("actorId", action, "entityType", "entityId") VALUES ($1, $2, $3, $4)
```

---

## Withdrawals

### GET `/withdrawals/mine`
```sql
SELECT
  id,
  "sellerId" AS "sellerId",
  amount,
  status,
  "reviewedById" AS "reviewedById",
  "reviewedAt" AS "reviewedAt",
  "createdAt" AS "createdAt",
  "updatedAt" AS "updatedAt"
FROM "WithdrawalRequest"
WHERE "sellerId" = $1
ORDER BY "createdAt" DESC
```

### POST `/withdrawals`
Transaction:
```sql
SELECT "walletBalance" FROM "User" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "User" SET "walletBalance" = "walletBalance" - $2 WHERE id = $1
```
```sql
INSERT INTO "WithdrawalRequest" ("sellerId", amount, status, "createdAt", "updatedAt")
VALUES ($1, $2, 'PENDING', NOW(), NOW())
RETURNING
  id,
  "sellerId" AS "sellerId",
  amount,
  status,
  "reviewedById" AS "reviewedById",
  "reviewedAt" AS "reviewedAt",
  "createdAt" AS "createdAt",
  "updatedAt" AS "updatedAt"
```

### GET `/withdrawals`
```sql
SELECT
  id,
  "sellerId" AS "sellerId",
  amount,
  status,
  "reviewedById" AS "reviewedById",
  "reviewedAt" AS "reviewedAt",
  "createdAt" AS "createdAt",
  "updatedAt" AS "updatedAt"
FROM "WithdrawalRequest"
WHERE status = $1
ORDER BY "createdAt" DESC
```

### POST `/withdrawals/:id/approve`
Transaction:
```sql
SELECT id, status FROM "WithdrawalRequest" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "WithdrawalRequest"
SET status = 'APPROVED', "reviewedById" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1
RETURNING
  id,
  "sellerId" AS "sellerId",
  amount,
  status,
  "reviewedById" AS "reviewedById",
  "reviewedAt" AS "reviewedAt",
  "createdAt" AS "createdAt",
  "updatedAt" AS "updatedAt"
```

### POST `/withdrawals/:id/reject`
Transaction:
```sql
SELECT * FROM "WithdrawalRequest" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "WithdrawalRequest"
SET status = 'REJECTED', "reviewedById" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1
RETURNING
  id,
  "sellerId" AS "sellerId",
  amount,
  status,
  "reviewedById" AS "reviewedById",
  "reviewedAt" AS "reviewedAt",
  "createdAt" AS "createdAt",
  "updatedAt" AS "updatedAt"
```
```sql
SELECT id FROM "User" WHERE id = $1 FOR UPDATE
```
```sql
UPDATE "User" SET "walletBalance" = "walletBalance" + $2 WHERE id = $1
```
