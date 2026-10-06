import { ImageVisibility } from "@prisma/client";

export type ListHostedImageQuery = {
  q?: string;
  visibility?: ImageVisibility;
};

export const MAX_HOSTED_IMAGE_BYTES = 25 * 1024 * 1024;

export const HOSTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
