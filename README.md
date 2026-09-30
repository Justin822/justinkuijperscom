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

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Ranking the Stars (teamspel)

Spelshow-app op `/rankingthestars` (optioneel ook via een subdomein `rankingthestars.` of `rts.`, zie `middleware.ts`).

- `/rankingthestars`: collega's rangschikken per vraag alle 12 collega's en vertellen het verhaal achter hun nummer 1.
- `/rankingthestars/host`: regiekamer (pincode): wie heeft gestemd, stembus open/dicht, stem resetten.
- `/rankingthestars/show`: de uitslag op het grote scherm (spatie/→ volgende, ← terug, F volledig scherm, M geluid). Met `?demo=1` draait een generale repetitie op nepdata.

Setup op Vercel:

1. Voeg **Upstash Redis** toe aan het project (Storage / Marketplace). Dat zet `KV_REST_API_URL` en `KV_REST_API_TOKEN` (of `UPSTASH_REDIS_REST_URL`/`_TOKEN`). Zonder database worden stemmen alleen tijdelijk bewaard.
2. Zet de env-variabelen en redeploy:
   - `RTS_TEAM_CODE`: teamcode waarmee collega's het spel openen (hoofdletterongevoelig). Zonder teamcode ziet een bezoeker alleen een inlogscherm, geen namen of vragen. Lokaal is de code `sterren`.
   - `RTS_ADMIN_PIN`: pincode voor regiekamer en show. Lokaal is de pincode `1234`.
3. Namen en vragen staan in `lib/rankingthestars/config.ts` (alleen server-side; ze gaan pas na de teamcode naar de browser). Pas alleen `name` aan, laat de `id` staan. Foto's kunnen in `public/rts-photos/`.
