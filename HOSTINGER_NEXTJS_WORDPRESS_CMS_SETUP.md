# Hostinger Next.js + WordPress CMS Setup Playbook

Use this checklist to deploy any Next.js website on Hostinger with a WordPress CMS for blog posts. Keep credentials out of the repo and out of chat wherever possible.

## 1. Accounts And Domains

Required access:

- Hostinger account with Next.js hosting enabled.
- GitHub repository access for the website.
- Domain DNS access.
- WordPress admin access for the CMS subdomain.

Recommended domain pattern:

- Main website: `https://example.com`
- CMS: `https://cms.example.com`

Decide the canonical host before deployment:

- Use either `example.com` or `www.example.com`, not both.
- Redirect the non-canonical host to the canonical host.
- Use the same canonical host in metadata, sitemap, robots, Open Graph URLs, and schema.

## 2. GitHub Token Handling

Do not commit tokens. Do not save tokens in `.env` unless the app truly needs them at runtime.

For one-time pushes from a machine, prefer a temporary shell variable:

```bash
export GITHUB_TOKEN="paste_token_here"
AUTH=$(printf '%s' "x-access-token:${GITHUB_TOKEN}" | base64)
git -c credential.helper= \
  -c http.https://github.com/.extraheader="AUTHORIZATION: basic $AUTH" \
  push origin master
unset GITHUB_TOKEN AUTH
```

After setup:

- Revoke the temporary token if it was shared anywhere.
- Use Hostinger's GitHub deployment connection for ongoing deploys.
- Do not put `GITHUB_TOKEN` into Hostinger environment variables unless the running website itself must call GitHub.

## 3. Hostinger Next.js Deployment

In Hostinger:

1. Create a new website or app.
2. Choose Next.js deployment.
3. Connect the GitHub repository.
4. Select the correct branch, usually `master` or `main`.
5. Set root directory to `./` unless the app is in a subfolder.
6. Use the Node version supported by the project. For this stack, Node `22.x` worked.
7. Use default build/output settings unless the project has custom output.

Recommended `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

Do not browse the deployed site with `:3000` in the URL. Hostinger proxies the app to normal HTTPS:

```text
Correct: https://example.com/
Wrong:   https://example.com:3000/
```

## 4. Hostinger Environment Variables

For a WordPress CMS blog setup, use:

```bash
WORDPRESS_GRAPHQL_URL=https://cms.example.com/graphql
REVALIDATION_SECRET=generate-a-long-random-secret
```

If the app uses WordPress REST as the primary source, `WORDPRESS_GRAPHQL_URL` can still point to `/graphql`; the app can derive the REST base from the same CMS domain.

Not needed for Hostinger direct Git deployment:

```bash
VERCEL_DEPLOY_HOOK_URL=
```

Only add storage variables if the project actually uses that storage provider. If images are uploaded into WordPress media, Vercel Blob is not required for new CMS posts.

## 5. WordPress CMS Subdomain

Create the CMS as a separate WordPress install:

1. In Hostinger, add subdomain `cms.example.com`.
2. Install WordPress on that subdomain.
3. Make sure the WordPress site URL is:

```text
https://cms.example.com
```

4. Enable SSL for the CMS subdomain.
5. If Hostinger CDN causes SSL or routing issues on the CMS, disable CDN for `cms.example.com` or place it in development mode while testing.

Quick checks:

```bash
curl -I https://cms.example.com/
curl -sS "https://cms.example.com/wp-json/wp/v2/posts?per_page=1"
```

Both should return successfully. If `https://cms.example.com/` fails SSL, fix SSL/CDN before debugging the Next.js app.

## 6. WordPress Plugins

Minimum:

- WordPress REST API: built into WordPress.

Optional:

- WPGraphQL if the app reads GraphQL.
- Rank Math or Yoast for WordPress SEO fields.
- A GraphQL SEO bridge only if the app reads SEO fields through GraphQL.

Recommended app behavior:

- Fetch WordPress posts through REST first.
- Use GraphQL only as a fallback.
- This avoids the whole blog breaking when WPGraphQL is missing, disabled, or returning 404.

Useful REST checks:

```bash
curl -sS "https://cms.example.com/wp-json/wp/v2/posts?status=publish&per_page=5&_fields=id,slug,status,title,link,date"
curl -sS "https://cms.example.com/wp-json/wp/v2/posts?slug=my-post-slug&_fields=id,slug,status,title,link,date"
```

If REST shows the post but the site does not, the issue is usually app cache, deployment, or mapping logic.

## 7. Next.js Blog Integration Pattern

Recommended behavior:

- Blog index reads all published WordPress posts.
- Individual blog page reads by slug.
- Local/static posts can remain as fallback.
- If a WordPress slug matches a local slug, choose one winner deliberately.
- Blog images should use WordPress featured images or in-content media URLs.

For `next/image`, allow the CMS image domain in `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cms.example.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
```

If the blog index must always show new CMS posts quickly, make the blog index dynamic:

```ts
export const dynamic = "force-dynamic";
```

Individual post pages can still use ISR:

```ts
export const revalidate = 60;
export const dynamicParams = true;
```

## 8. Revalidation

Create a long random secret:

```bash
openssl rand -hex 32
```

Set it in Hostinger:

```bash
REVALIDATION_SECRET=the_generated_secret
```

A revalidation endpoint can clear the blog index and a specific slug after publishing:

```text
https://example.com/api/revalidate?secret=SECRET&slug=my-post-slug
```

If not using webhooks yet, dynamic rendering for `/blog` is the simplest reliable option.

## 9. Sitemap And Robots

Use the canonical host only:

```ts
const siteUrl = "https://example.com";
```

Sitemap should include:

- Homepage
- Main pages: `/services`, `/about`, `/blog`, `/contact`
- Canonical service pages
- Blog posts from WordPress and local data

Robots should point to the canonical sitemap:

```ts
sitemap: `${siteUrl}/sitemap.xml`
```

Check:

```bash
curl -sS https://example.com/sitemap.xml | grep "https://www.example.com"
```

This should return nothing if the canonical host is non-www.

## 10. Redirect Rules

If canonical is non-www:

```text
https://www.example.com/* -> https://example.com/*
```

If old service URLs changed, redirect old paths to new canonical paths:

```text
/services/dewa -> /services/dewa-approvals-dubai
/services/dubai-municipality -> /services/dubai-municipality-approvals
```

Avoid two-hop redirects. A request like:

```text
https://www.example.com/services/dewa
```

should go directly to:

```text
https://example.com/services/dewa-approvals-dubai
```

## 11. Deployment Verification

After every push:

1. Confirm GitHub received the commit:

```bash
git ls-remote origin refs/heads/master
```

2. Wait for Hostinger deployment to complete.
3. Check headers:

```bash
curl -I https://example.com/
curl -I https://example.com/blog
curl -I https://www.example.com/
```

4. Check metadata:

```bash
curl -sS https://example.com/ | grep -E "<title>|description|canonical"
```

5. Check a WordPress post:

```bash
curl -sS https://example.com/blog/my-post-slug | grep "Expected title"
```

6. Check blog listing:

```bash
curl -sS https://example.com/blog | grep "my-post-slug"
```

7. Check sitemap host:

```bash
curl -sS https://example.com/sitemap.xml | grep "https://www.example.com"
```

If that returns anything, sitemap still has the wrong host.

## 12. Common Problems

### Site times out

Check:

- App URL without `:3000`.
- Hostinger runtime logs.
- Build completed successfully.
- Environment variables are set.
- Node version matches the app.

### CMS opens main website instead of WordPress

Likely subdomain points to the wrong app/root. Check:

- Subdomain document root.
- DNS record for `cms`.
- Hostinger subdomain setup.
- CDN configuration.

### CMS HTTPS fails

Check:

- SSL is installed for `cms.example.com`.
- CDN is disabled or correctly configured for the CMS subdomain.
- `curl -I https://cms.example.com/` returns 200 or 301, not TLS errors.

### WordPress post page works but `/blog` does not list it

Likely stale prerender cache. Fix options:

- Make `/blog` dynamic.
- Revalidate `/blog` after publishing.
- Confirm `/blog` fetches REST list, not only GraphQL.

### GraphQL returns WordPress 404 page

WPGraphQL is missing, disabled, or rewrite rules are broken. Fix options:

- Install/activate WPGraphQL.
- Re-save WordPress permalinks.
- Use REST as primary source.

### Hostinger resources reached

Avoid bulk migrations while the site is live. Do not import many images/posts at once. Batch large migrations and monitor:

- CPU
- Memory
- PHP workers
- Inodes
- Disk

## 13. Safe Setup Order

Use this order for any new site:

1. Decide canonical domain.
2. Connect GitHub to Hostinger.
3. Deploy plain Next.js app first.
4. Add domain and SSL.
5. Confirm site loads on canonical domain.
6. Create `cms` subdomain.
7. Install WordPress and SSL.
8. Confirm REST API works.
9. Add CMS environment variables.
10. Add/verify Next.js CMS integration.
11. Publish one test post.
12. Confirm post URL works.
13. Confirm `/blog` lists the post.
14. Confirm sitemap uses canonical domain.
15. Revoke any temporary GitHub token used during setup.
