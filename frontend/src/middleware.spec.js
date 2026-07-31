const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { strict: assert } = require("node:assert");
const { test } = require("node:test");

const frontendRoot = join(__dirname, "..");
const repositoryRoot = join(frontendRoot, "..");

test("frontend is exported as static files without Next runtime routes", () => {
  const nextConfig = readFileSync(join(frontendRoot, "next.config.js"), "utf8");
  const entrypoint = readFileSync(
    join(repositoryRoot, "scripts/docker/entrypoint.sh"),
    "utf8",
  );

  assert.match(nextConfig, /output:\s*"export"/);
  assert.equal(existsSync(join(__dirname, "middleware.ts")), false);
  assert.equal(existsSync(join(__dirname, "pages/api/[...all].tsx")), false);
  assert.doesNotMatch(entrypoint, /frontend\/server\.js|next-server/);
});

test("Caddy serves dynamic placeholders and delegates short links to Nest", () => {
  const caddy = readFileSync(
    join(repositoryRoot, "reverse-proxy/Caddyfile"),
    "utf8",
  );
  const shortLinkController = readFileSync(
    join(repositoryRoot, "backend/src/shortLink/shortLink.controller.ts"),
    "utf8",
  );

  assert.match(caddy, /\/api\/short-links\/\{re\.short\.1\}\/open/);
  assert.match(caddy, /rewrite @share \/share\/_\//);
  assert.match(caddy, /rewrite @inbox \/inbox\/_\//);
  assert.match(caddy, /rewrite @reverseShare \/upload\/_\//);
  assert.match(shortLinkController, /@Get\(":code\/open"\)/);
  assert.match(shortLinkController, /`\/share\/\$\{encodeURIComponent\(code\)\}/);
});

test("backend authorization keeps visitor routes public", () => {
  const appController = readFileSync(
    join(repositoryRoot, "backend/src/app.controller.ts"),
    "utf8",
  );

  assert.match(appController, /@Get\("frontend-route"\)/);
  for (const route of ["/share/*", "/s/*", "/upload/*", "/inbox/*"]) {
    assert.ok(appController.includes(`"${route}"`), `${route} must stay public`);
  }
});
