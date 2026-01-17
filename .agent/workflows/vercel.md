---
description: How to check Vercel deployment status and logs via CLI
---

# Vercel Deployment Workflow

This project deploys automatically to Vercel when pushing to the `main` branch.

## Project Details
- **Production URL:** https://readsfast.vercel.app/
- **Project:** rsvp-reader

## Check Deployment Status

// turbo
1. List recent deployments:
```bash
vercel list
```

This shows all deployments with their status (Ready, Error, Building).

## View Deployment Logs

// turbo
2. For a failed/errored deployment, view logs:
```bash
vercel logs <deployment-url>
```

Example:
```bash
vercel logs https://rsvp-reader-epj22njs7-dirtmans-projects.vercel.app
```

## Inspect Deployment Details

// turbo
3. Get detailed build info:
```bash
vercel inspect <deployment-url>
```

## Common Deployment Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Function Runtimes must have a valid version" | Invalid runtime in vercel.json | Remove runtime specification, use `export const config = { runtime: 'edge' }` in the function file |
| Edge Function timeout | Function takes too long | Increase `maxDuration` in vercel.json or optimize function |
| Build failed | Code error | Check `vercel logs` for details |

## Edge Functions

Edge Functions are defined in the `/api` directory. To create one:

1. Create file in `/api/my-function.js`
2. Add runtime config at top:
```javascript
export const config = { runtime: 'edge' };
```
3. Export default async handler
4. Access via `/api/my-function`

## Redeploy

// turbo
To trigger a redeploy without code changes:
```bash
vercel --prod
```
