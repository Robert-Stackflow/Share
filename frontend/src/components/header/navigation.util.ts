export const isRouteWithin = (pathname: string, root: string): boolean =>
  pathname === root || (root !== "/" && pathname.startsWith(`${root}/`));

export const contentRoutes = [
  "/account/assets",
  "/account/shares",
  "/account/reverseShares",
] as const;

export const isContentRoute = (pathname: string): boolean =>
  contentRoutes.some((root) => isRouteWithin(pathname, root));

export const isProfileRoute = (pathname: string): boolean =>
  (isRouteWithin(pathname, "/account") || isRouteWithin(pathname, "/admin")) &&
  !isContentRoute(pathname);
