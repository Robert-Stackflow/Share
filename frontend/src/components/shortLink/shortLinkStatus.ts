import { ShortLink } from "../../types/shortLink.type";

export type ShortLinkStatus = "active" | "disabled" | "expired" | "limit";

export const getShortLinkStatus = (link: ShortLink): ShortLinkStatus => {
  if (!link.isActive) return "disabled";
  const policy = link.accessControl;
  if (!policy) return "active";

  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }

  const limit = policy.oneTime ? 1 : policy.maxViews;
  if (limit != null && policy.views >= limit) return "limit";

  return "active";
};
