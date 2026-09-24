import { ShortLinkTargetType } from "../../types/shortLink.type";

export const isWebUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return (
      !/\s/.test(value.trim()) && ["http:", "https:"].includes(url.protocol)
    );
  } catch {
    return false;
  }
};

export const isValidTarget = (type: ShortLinkTargetType, value: string) =>
  type === "URL"
    ? isWebUrl(value)
    : value.startsWith("/") && !value.startsWith("//");
