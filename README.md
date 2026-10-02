This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Stripe billing setup

Configure these server-side environment variables in local development and in your deployment environment:

- `STRIPE_SECRET_KEY`: Stripe secret API key; never expose it to the browser.
- `STRIPE_PRO_PRICE_ID`: recurring Stripe Price ID for the Pro subscription.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the Stripe webhook endpoint.
- `NEXTAUTH_URL` (or `NEXT_PUBLIC_APP_URL`): public application origin used for Stripe return URLs.

Register `POST /api/billing/webhook` as a Stripe webhook endpoint and subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `customer.deleted`. The app only changes subscription access after validating Stripe's webhook signature. Configure the Stripe Customer Portal in the Stripe Dashboard before using Manage Billing.
