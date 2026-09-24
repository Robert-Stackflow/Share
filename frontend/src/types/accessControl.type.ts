export type AccessControl = {
  password?: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  allowDownload?: boolean;
  allowAnonymous?: boolean;
  oneTime?: boolean;
};

export type AccessControlField = keyof AccessControl;

/**
 * Returns an accessControl payload containing only the fields the user actually
 * set, or `undefined` when nothing is set. Callers can spread this directly into
 * their create/update body as `accessControl: toAccessControlPayload(value)` so
 * the field is omitted entirely (legacy behavior) when untouched.
 */
export const toAccessControlPayload = (
  value: AccessControl | undefined,
): AccessControl | undefined => {
  if (!value) return undefined;

  const payload: AccessControl = {};

  if (typeof value.password === "string" && value.password.trim().length > 0) {
    payload.password = value.password;
  }
  if (
    typeof value.expiresAt === "string" &&
    value.expiresAt.trim().length > 0
  ) {
    payload.expiresAt = new Date(value.expiresAt).toISOString();
  } else if (value.expiresAt === null || value.expiresAt === "") {
    payload.expiresAt = null;
  }
  if (typeof value.maxViews === "number" && value.maxViews > 0) {
    payload.maxViews = value.maxViews;
  } else if (value.maxViews === null) {
    payload.maxViews = null;
  }
  if (typeof value.allowDownload === "boolean") {
    payload.allowDownload = value.allowDownload;
  }
  if (typeof value.allowAnonymous === "boolean") {
    payload.allowAnonymous = value.allowAnonymous;
  }
  if (typeof value.oneTime === "boolean") {
    payload.oneTime = value.oneTime;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
};
