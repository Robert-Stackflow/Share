import { ImageVisibility } from "@prisma/client";

export type ListHostedImageQuery = {
  q?: string;
  visibility?: ImageVisibility;
};

export const DEFAULT_MAX_HOSTED_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_HOSTED_IMAGE_HARD_BYTES = 100 * 1024 * 1024;
export const MAX_HOSTED_IMAGE_BATCH_SIZE = 100;

export const HOSTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type HostedImageStats = {
  count: number;
  publicCount: number;
  privateCount: number;
  totalSize: number;
};
