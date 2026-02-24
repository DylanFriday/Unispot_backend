# UniSpot API Contract

## Global
- Base URL: `http://localhost:3000`
- Auth header (protected routes): `Authorization: Bearer <token>`
- JSON body header: `Content-Type: application/json`
- Validation: global Nest `ValidationPipe({ whitelist: true, transform: true })`
- Common error shape:
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

## Auth
### POST `/auth/register`
- Body: `{ email, name, password }`
- Success: `{ access_token }`
- Status: `201`, `400`

### POST `/auth/login`
- Body: `{ email, password }`
- Success: `{ access_token }`
- Status: `200`, `400`, `401`

### GET `/auth/me`
- Auth required
- Success: profile object (`id,email,role,name,fullName,avatarUrl,phone,bio,createdAt,updatedAt`)
- Status: `200`, `401`, `404`

### PATCH `/auth/me`
- Auth required
- Body (optional fields): `{ name, fullName, avatarUrl, phone, bio }`
- Success: updated profile object
- Status: `200`, `400`, `401`, `404`

## Me
### GET `/me`
- Auth required
- Success: profile object

### PATCH `/me`
- Auth required
- Body: `{ name?, fullName?, avatarUrl?, phone?, bio? }`
- Success: updated profile object

### PATCH `/me/password`
- Auth required
- Body: `{ currentPassword, newPassword }`
- Success: `{ success: true }`
- Status: `200`, `400`, `401`, `404`

### GET `/me/wallet`
- Auth required
- Success: `{ walletBalance, totalEarned, pendingPayout }`

## Dashboards
### GET `/dashboard/summary` (STUDENT)
- Success:
```json
{
  "walletBalance": 0,
  "myStudySheets": { "total": 0, "pending": 0, "approved": 0, "rejected": 0 },
  "mySales": { "totalSalesCount": 0, "totalSalesAmountCents": 0, "pendingPayoutCents": 0, "releasedPayoutCents": 0 },
  "myPurchases": { "totalPurchasesCount": 0, "totalSpentCents": 0 },
  "myLeases": { "total": 0, "pending": 0, "approved": 0, "rejected": 0, "transferred": 0 },
  "myReviews": { "total": 0, "visible": 0, "underReview": 0, "removed": 0 }
}
```

### GET `/admin/dashboard/summary` (ADMIN)
- Success: users/studySheets/payments/moderationQueue/leases/reviews/topCourses summary

## Courses
### GET `/courses`
- Query: `query?`
- Success: `[{ id, code, name }]`

### POST `/courses` (STUDENT)
- Body: `{ code, name }`
- Success: course object

## Teachers
### GET `/courses/:id/teachers`
- Success: `[{ id, name }]`

### POST `/courses/:id/teachers` (ADMIN)
- Body: `{ teacherName }`
- Success: `{ id, name }`

## Study Sheets
### POST `/study-sheets` (STUDENT)
- Body: `{ title, description?, fileUrl, priceCents, courseCode }`
- Success: created study sheet row

### GET `/study-sheets`
- Query: `courseCode?`
- Success: approved study sheets, includes `courseCode`

### GET `/study-sheets/mine` (STUDENT)
- Success: owner sheets

### GET `/study-sheets/purchased` (STUDENT)
- Success:
```json
[
  {
    "purchaseId": 1,
    "purchasedAt": "ISO",
    "amountCents": 1000,
    "studySheet": {
      "id": 1,
      "title": "...",
      "description": null,
      "fileUrl": "...",
      "priceCents": 1000,
      "status": "APPROVED",
      "createdAt": "ISO",
      "updatedAt": "ISO",
      "ownerId": 2,
      "courseId": 3,
      "courseCode": "CS101"
    }
  }
]
```

### POST `/study-sheets/:id/purchase` (STUDENT)
- Success: `{ id, reference_code, amount }`

### PATCH `/study-sheets/:id` (STUDENT owner)
- Body: `{ title?, description?, fileUrl?, priceCents? }`
- Success: updated row

### DELETE `/study-sheets/:id` (STUDENT owner)
- Success: deleted row

## Study Sheet Moderation (STAFF/ADMIN)
- GET `/moderation/study-sheets?status=PENDING|APPROVED|REJECTED`
- POST `/moderation/study-sheets/:id/approve`
- POST `/moderation/study-sheets/:id/reject` body `{ reason }`

## Payments (ADMIN)
- GET `/admin/payments?status=PENDING|APPROVED|RELEASED`
- POST `/admin/payments/:id/confirm`
- POST `/admin/payments/:id/release`

## Lease Listings
- GET `/lease-listings` (public)
- GET `/lease-listings/mine` (STUDENT)
- POST `/lease-listings` (STUDENT)
- PATCH `/lease-listings/:id` (STUDENT owner)
- DELETE `/lease-listings/:id` (STUDENT owner)
- POST `/lease-listings/:id/interest` (STUDENT)
- POST `/lease-listings/:id/transfer` (STUDENT owner or ADMIN)
- `lineId` supported (nullable)

## Lease Moderation (STAFF/ADMIN)
- GET `/moderation/lease-listings?status=...`
- POST `/moderation/lease-listings/:id/approve`
- POST `/moderation/lease-listings/:id/reject` body `{ reason }`

## Reviews
- GET `/courses/:id/reviews` (public)
- POST `/reviews` (STUDENT)
- PATCH `/reviews/:id` (STUDENT owner)
- DELETE `/reviews/:id` (STUDENT owner)
- POST `/reviews/:id/report` (STUDENT)
- POST `/reviews/:id/upvote` (STUDENT)
- DELETE `/reviews/:id/upvote` (STUDENT)

## Review Moderation (STAFF/ADMIN)
- GET `/moderation/reviews?status=...`
- POST `/moderation/reviews/:id/approve`
- POST `/moderation/reviews/:id/remove`

## Teacher Reviews
- GET `/courses/:courseId/teacher-reviews` (public, optional JWT)
- GET `/courses/:courseId/teachers/:teacherId/reviews` (public)
- POST `/teacher-reviews` (STUDENT)
- PATCH `/teacher-reviews/:id` (STUDENT owner)
- DELETE `/teacher-reviews/:id` (STUDENT owner)
- POST `/teacher-reviews/:id/report` (STUDENT)
- POST `/teacher-reviews/:id/upvote` (STUDENT)
- DELETE `/teacher-reviews/:id/upvote` (STUDENT)

## Teacher Review Moderation (STAFF/ADMIN)
- GET `/moderation/teacher-reviews?status=...`
- POST `/moderation/teacher-reviews/:id/approve`
- POST `/moderation/teacher-reviews/:id/remove`

## Withdrawals
### POST `/withdrawals` (STUDENT)
- Body: `{ amountCents }`
- Success: withdrawal row

### GET `/withdrawals/mine` (STUDENT)
- Success: own withdrawal rows (desc)

### GET `/withdrawals` (ADMIN)
- Query: `status?` defaults to `PENDING`

### POST `/withdrawals/:id/approve` (ADMIN)
- Success: updated withdrawal row (`APPROVED`)

### POST `/withdrawals/:id/reject` (ADMIN)
- Success: updated withdrawal row (`REJECTED`, wallet refunded)
