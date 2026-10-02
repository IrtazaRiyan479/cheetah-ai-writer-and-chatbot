# AffiGenie Operator Documentation

## 1. Overview

AffiGenie is an AI writing and affiliate-publishing web application.

| Area | Implementation |
|---|---|
| Web framework | Next.js App Router, including localized routes under `src/app/[lang]`. |
| Language | JavaScript and JSX. |
| UI | MUI with Vuexy layout/components and local utility classes. |
| Data access | Prisma ORM. The checked Prisma datasource is MySQL. |
| Authentication | NextAuth credentials and Google providers (`src/libs/auth.js`). |
| Main product flow | Select a writer type → configure article → generate outline → generate sections → edit → save draft or publish. |

The application also includes Amazon-focused writing, affiliate links, image generation, WordPress publishing, Stripe billing, newsletter signup, and a private admin console.

## 2. Users, plans, limits, and feature flags

Server-side entitlement uses the Prisma user record. `getDbUser` loads that record; `assertCanGenerate` checks the user and the requested feature (`src/libs/entitlement.js`). A client-supplied role is not authoritative.

| Database role/plan | Entitlement behavior |
|---|---|
| `free` | Uses feature access mode and the applicable free word limit. |
| `pro` | Considered paid by generation entitlement checks. |
| `admin` | Considered paid by generation entitlement checks. Admin-console access additionally requires DB role `admin` and a valid unlock cookie. |

Feature access modes are `free`, `pro`, and `off`. `off` is a kill switch: entitlement denies that feature, including for admins. `free` permits free users; `pro` requires paid access. The Top Pick roundup layout is not a feature flag.

The feature keys in `FEATURE_KEYS` are:

`standard`, `rewrite`, `amazon-roundup`, `amazon-review`, `amazon-roundup-rewrite`, `amazon-review-rewrite`, `listicle`, `local-roundup`, `youtube-blog`, `product-comparison`, `wp-publish`, `image-standalone`, `batch-generate`.

The code defines a default free word cap of 5,000. A DB-backed `globalFreeWordCap` setting and per-user word limit are supported. Saved-word accounting is performed by `recordSavedWords` when draft/article content is saved; do not assume it is a lifetime token or generation counter. Do not change cutoff or cap math without a separately approved task.

Generation, batch generation, standalone image generation, and WordPress publishing use `assertCanGenerate` at their API entry points. Verify the flag mode and role in the database when investigating an unexpected access denial.

## 3. Authentication and password changes

NextAuth has an email/password credentials provider (password hashes are checked with bcrypt) and a Google provider. The session callback looks up the user in Prisma and attaches the DB-derived ID, role, plan, and usage properties.

Password change is `POST /api/user/password`. It requires the current password and a new password of at least eight characters. The server verifies the current password before saving the new hash. Never expose hashes in API responses or logs.

### Admin-console unlock

Admin-page access has two requirements:

1. The signed-in account’s **database role** is `admin`.
2. The operator enters the server-only `ADMIN_PANEL_KEY` at `POST /api/admin/unlock`.

Successful unlock issues an HTTP-only, Secure, SameSite Strict cookie with an approximately eight-hour lifetime. `POST /api/admin/lock` clears the cookie. Admin APIs verify both the DB role and the unlock cookie. The unlock endpoint has in-memory failure backoff. Do not store the key in client storage, include its value in support requests, or log it.

## 4. Writer article types

The article-type IDs are presented in `src/views/apps/writer/ArticleTypeMenu.jsx` and dispatched by `src/app/api/generate/route.js`.

| ID | Display name | Purpose |
|---|---|---|
| `blog` | Blog Post | Standard keyword-led article. |
| `listicle` | Listicle | Article organized as a list. |
| `local-roundup` | Local Places Roundup | Local places/business roundup. |
| `amazon-roundup` | Amazon Product Roundup | Amazon product roundup. |
| `amazon-review` | Amazon Single Product Review | Review of one Amazon product. |
| `product-comparison` | Product Comparison | Compare two or three submitted product URLs. |
| `youtube-blog` | YouTube Video to Blog Post | Video-to-article flow. |
| `rewrite` | Rewrite Blog Post | Rewrite an existing article URL. |
| `amazon-roundup-rewrite` | Rewrite Amazon Product Roundup | Rewrite an existing Amazon roundup. |
| `amazon-review-rewrite` | Rewrite Amazon Single Product Review | Rewrite an existing Amazon single-product review. |

### Product Comparison

The form has two required product URL inputs and an optional third. The server validates that there are two or three URLs before proceeding. Existing Amazon roundup helpers are reused for product data and affiliate URL handling. The comparison article contains product evaluations, a responsive comparison table, FAQs, and a final verdict. The writer runs comparison article sections with concurrency one.

**Not confirmed in code:** external Amazon/API availability, complete rating/customer-feedback fields returned by the configured product source, and successful end-to-end comparison generation in the target deployment. Test with permitted URLs and non-production usage before relying on results.

### Amazon roundup layouts

`roundupLayout` accepts `table` or `top-pick` and defaults to `table` when unset. Product Table uses the shared responsive table renderer. Top Pick uses ranked cards and is intended to be a mutually exclusive alternative, not a second table. The first card receives the Top Pick mark. Check the generated article at mobile widths before publishing.

### Batch generation

`POST /api/generate/batch` accepts an `articles` array and checks the `batch-generate` entitlement. The writer submits one keyword per line and reports a Pro-upgrade message for HTTP 402/403. Batch state is held in process memory in the current implementation; persistence across restarts or multiple application instances is **Not confirmed in code**.

## 5. Generation pipeline and shared helpers

The writer sends outline requests to `/api/generate`, then ArticleEditor sends section requests. Service-specific outline/section functions handle the selected article type. Some flows obtain Amazon product data, search/SERP data, or relevant images as part of outline/setup or section work. Avoid assuming every article type follows an identical fetch order.

The shared `callLLM` provider order is:

1. xAI / Grok
2. Mistral
3. Groq
4. Gemini

The Gemini key pool is implemented in `src/app/api/generate/utils/geminiKeys.js`. It reads an ordered set from `GEMINI_API_KEYS`, numbered key variables, then legacy key variables; quota/rate-limit/503 errors move to the next key. Do not reorder providers or log keys.

Shared utilities in `src/app/api/generate/utils/articleHtml.js` include:

- English affiliate CTA label: **Check Price on Amazon.**
- Amazon affiliate URL resolution and ASIN-based URL construction.
- `renderResponsiveTable` and `.affigenie-table` mobile-card CSS.
- `renderTopPickCards` for the roundup Top Pick layout.
- Article HTML preparation/finalization helpers.

`serializeError` in `src/utils/serializeError.js` converts failures into bounded user-readable strings and avoids `[object Object]`. Use it for API/UI errors instead of returning raw error objects.

## 6. Images

The shared stock-image helpers use Pexels, Pixabay, and Unsplash when configured. `pickRelevantImages` scores and filters candidates to reduce irrelevant/generic imagery. The branded-hero helper uses a relevant photo where available and a branded gradient fallback otherwise.

The standalone image page is `src/views/apps/images/ImageGeneratorBoard.jsx`; its API is `/api/generate-image`:

- `GET` requires a signed-in user and returns that user’s history.
- `POST` uses the `image-standalone` entitlement and emits progress/results over Server-Sent Events (SSE). The UI shows Preparing, Generating, Done, or Error state and disables Generate while the stream is active.
- `DELETE` requires a DB admin and removes image records globally.
- TinyPNG compression is attempted when lossless output is disabled; if compression fails, the original image is retained.

The UI no longer seeds demo gallery entries. An empty history is a valid state.

## 7. WordPress publishing

`POST /api/publish` checks `wp-publish` entitlement. It can upload a featured image and sets the returned media ID as WordPress `featured_media`; the hero is also retained in article content when applicable. WordPress and network failures are returned through `serializeError`.

Use a non-production WordPress site for smoke tests. Verify both featured media and in-content images before approving a live publish. Do not use this guide as permission to publish test material to a client site.

## 8. Stripe billing and newsletter

The billing integration uses direct Stripe REST requests in `src/libs/stripe.js`.

| Route | Purpose |
|---|---|
| `POST /api/billing/checkout` | Starts the configured Pro subscription checkout flow. |
| `POST /api/billing/portal` | Opens the signed-in customer’s existing Stripe billing portal. |
| `POST /api/billing/webhook` | Verifies Stripe webhook signatures and synchronizes supported subscription/customer events to user records. |

Environment names referenced by the billing implementation include `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID`. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may be used by other deployment/client code; necessity in the checked server-side REST billing path is **Not confirmed in code**. Do not change live Stripe IDs or webhook configuration from the admin pricing-copy UI.

`POST /api/subscribe` is newsletter signup through the mail integration. It is separate from Stripe checkout/subscription billing.

## 9. Admin console

The private admin console contains Overview, Users, Feature flags, Limits, and Pricing copy tabs. It requires a DB admin role plus the unlock cookie described above.

- **Users:** Prisma-backed account listing and supported user-management operations. API output omits password hashes. The API prevents deleting the last admin and guards against self-demotion/deletion. Deleting a user does not delete WordPress posts.
- **Feature flags:** database-backed `free`, `pro`, or `off` values; missing configured flags are seeded without wiping users.
- **Limits:** DB-backed global free cap plus per-user word limit.
- **Pricing copy:** display text only; it does not update Stripe products, prices, IDs, checkout, or webhooks.
- **Billing status:** sourced from the user row; the existing portal endpoint is used rather than creating another checkout path.

Overview/statistics depend on the admin stats endpoint and current database schema. Confirm the migration/client is applied in the target environment before relying on these values.

## 10. Environment-variable reference (names only)

Actual values are secrets and intentionally omitted. Which values are required depends on the enabled feature and deployment.

| Group | Environment variable names | Notes |
|---|---|---|
| Database/auth | `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Prisma datasource and NextAuth deployment. The checked Prisma datasource provider is MySQL. |
| OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in provider. |
| Admin | `ADMIN_PANEL_KEY` | Server-only admin unlock key; never prefix with `NEXT_PUBLIC_`. |
| LLM providers | `XAI_API_KEY`, `XAI_MODEL`, `MISTRAL_API_KEY`, `GROQ_API_KEY` | LLM provider configuration; provider order is code-controlled. |
| Gemini key pool | `GEMINI_API_KEYS`, `GEMINI_API_KEY_1` … `GEMINI_API_KEY_10` | Optional ordered multi-key pool sources. |
| Gemini legacy keys | `GEMINI_API_KEY`, `GEMINI_FREE_API_KEY`, `GEMINI_PAID_API_KEY` | Preserved as pool sources for compatibility. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe secret/webhook/price are used by billing routes; publishable-key usage in the checked server billing path is not confirmed. |
| Amazon product API | `AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_PARTNER_TAG` | Product lookup and affiliate tagging, subject to provider configuration. |
| Stock images/compression | `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `UNSPLASH_API_KEY`, `TINYPNG_API_KEY` | Optional image providers and compression. |
| Search/data | `SERPER_API_KEY`, `SERP_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Service-specific search/keyword integrations; exact usage varies by helper. |
| Mail | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Newsletter/mail configuration. |
| Other integration/deployment names | `MAPBOX_ACCESS_TOKEN`, `RAPIDAPI_KEY`, `YOUTUBE_API_KEY`, `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DOCS_URL`, `BASEPATH`, `NEXTAUTH_BASEPATH`, `PREDEFINED_WP_SITES`, `VERCEL_URL`, `NODE_ENV` | Feature/deployment-specific. Requirement for each must be checked against the deployment and its enabled features. |

Do not copy values into docs, chat, tickets, or logs. Add or rotate secrets only through the approved deployment-secret process.

## 11. Main API map

| Path | Method(s) | Purpose |
|---|---|---|
| `/api/generate` | POST | Chat, prepare, outline, and section generation modes; entitlement and serialization are server-side. |
| `/api/generate/batch` | POST, GET | Start/continue batch work and retrieve batch state. |
| `/api/generate-image` | GET, POST, DELETE | User-scoped image history, SSE generation, admin-only global delete. |
| `/api/amazon` | POST | Existing Amazon product lookup used by product-writing flows. |
| `/api/publish` | POST | Publish article to configured WordPress; featured media and serialized errors. |
| `/api/drafts` | GET, POST, DELETE | Authenticated draft operations. |
| `/api/user/password` | POST | Change password using current and new password. |
| `/api/user/settings` | GET, PATCH | Account settings and supported profile update. |
| `/api/billing/checkout` | POST | Create subscription checkout session. |
| `/api/billing/portal` | POST | Create customer portal session. |
| `/api/billing/webhook` | POST | Process signed Stripe events. |
| `/api/subscribe` | POST | Newsletter subscription; not Stripe. |
| `/api/admin/unlock` | POST | Validate unlock key for a DB admin and set cookie. |
| `/api/admin/lock` | POST | Clear admin unlock cookie. |
| `/api/admin/users` | GET, POST, PATCH, DELETE | Prisma user administration. |
| `/api/admin/flags` | GET, PATCH | Seed/read/update feature flags. |
| `/api/admin/stats` | GET, PATCH | Overview data and global free word cap. |
| `/api/admin/settings` | GET, PUT | Persist display-only pricing copy. |
| `/api/links` | POST | Link-crawl/analyze operations. |
| `/api/magnets` | POST | Lead-magnet configuration/execution flow. |
| `/api/poll` | GET | Poll an existing Gemini interaction. |

Route availability does not imply all third-party environment values are configured.
