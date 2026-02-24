# UniSpot Data Model and Backend Logic

## AuthN/AuthZ
- JWT secret: `process.env.JWT_SECRET || 'dev-secret'`
- JWT expiry: `1d`
- JWT payload: `{ userId, role }`
- Current user extracted by `@CurrentUser()` from `request.user`
- Password hashing: `bcryptjs`, rounds `10`
- Role guard: `RolesGuard` with `@Roles(...)`

## Enums
- Role: `STUDENT`, `STAFF`, `ADMIN`
- StudySheetStatus: `PENDING`, `APPROVED`, `REJECTED`
- PaymentStatus: `PENDING`, `APPROVED`, `RELEASED`
- ApprovalDecision: `APPROVED`, `REJECTED`
- LeaseStatus: `PENDING`, `APPROVED`, `REJECTED`, `TRANSFERRED`
- LeaseApprovalDecision: `APPROVED`, `REJECTED`
- ReviewStatus: `VISIBLE`, `UNDER_REVIEW`, `REMOVED`
- AuditEntityType, AuditAction (study/payment/lease/review/withdraw actions)

## Tables (high level)
- `User`
- `Course`
- `StudySheet`
- `StudySheetApproval`
- `Purchase`
- `Payment`
- `AuditLog`
- `WithdrawalRequest`
- `LeaseListing`
- `LeaseApproval`
- `InterestRequest`
- `Review`
- `ReviewHistory`
- `ReviewReport`
- `ReviewVote`
- `Teacher`
- `CourseTeacher`
- `TeacherReview`
- `TeacherReviewHistory`
- `TeacherReviewReport`
- `TeacherReviewVote`

## Keys / Constraints / Indexes (highlights)
- PK: all tables use `id` serial primary key
- Unique:
  - `User.email`
  - `Course.code`
  - `Payment.purchaseId`
  - `Payment.referenceCode`
  - `StudySheetApproval.studySheetId`
  - `Purchase(studySheetId,buyerId)`
  - `LeaseApproval.leaseListingId`
  - `InterestRequest(leaseListingId,studentId)`
  - `Review(studentId,courseId)`
  - `Teacher.name`
  - `CourseTeacher(courseId,teacherId)`
  - vote/report composite unique constraints
- Indexed: status and FK columns across major tables

## Foreign Keys and delete rules
- Mostly `ON DELETE RESTRICT`
- `ON DELETE SET NULL`:
  - `Payment.approvedById`
  - `Payment.releasedById`
  - `WithdrawalRequest.reviewedById`
  - `TeacherReview.teacherId`
  - `TeacherReview.reviewedById`

## Raw SQL patterns by feature
- Study sheet marketplace: join `StudySheet` + `Course` for `courseCode`
- Purchased sheets: join `Purchase` + `StudySheet` + `Course`
- Payments: confirm/release with transaction + `FOR UPDATE`
- Withdrawals: create/approve/reject with transaction and wallet locks
- Leases: create/update/list; optional `lineId` column compatibility check via `information_schema.columns`
- Reviews/teacher reviews: report/upvote/history/moderation lifecycle SQL
- Dashboards: aggregate SQL (`COUNT`, `SUM`, `AVG`, `COALESCE`, `ROUND`)

## Joins used
- `StudySheet` -> `Course`
- `Purchase` -> `StudySheet` -> `Course`
- `CourseTeacher` -> `Teacher`
- `Course` -> `Review`

## Aggregations
- Student dashboard and admin dashboard use SQL aggregates
- Wallet summary uses conditional sums by payment status
- Top courses uses review count + rounded avg rating, limited to 5

## Pagination
- No offset/page pagination currently implemented
- Ordering is used (`ORDER BY createdAt`/name)

## Business Rules (critical)
- Payment release credits seller wallet
- Withdraw create deducts wallet immediately (PENDING)
- Withdraw approve does not touch wallet
- Withdraw reject refunds wallet
- Student role required for student actions; staff/admin for moderation; admin for admin actions
- Ownership checks enforced on update/delete paths
- Profile password change has in-memory cooldown (1 minute)

## Environment / Infra
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `PROMPTPAY_PHONE`
- CORS: `http://localhost:5173`, credentials enabled
- No backend file upload endpoint (avatar is URL field)
- No global rate-limit module; only password-change cooldown in service
