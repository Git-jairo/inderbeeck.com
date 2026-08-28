# inderbeeck.com

Personal portfolio. Built with [Vite](https://vite.dev), React 19, TypeScript and
[Tailwind CSS](https://tailwindcss.com) v4. Deployed on [Vercel](https://vercel.com).

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build locally
npm run lint       # ESLint
npm run format     # Prettier (writes)
npm run typecheck  # tsc, no emit
```

## Deployment

Pushes to `main` deploy to production automatically via the connected Vercel project.
Pull request branches get preview deployments.
