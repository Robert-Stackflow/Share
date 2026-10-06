import { ImageVisibility } from "@prisma/client";

export type ListHostedImageQuery = {
  q?: string;
  visibility?: ImageVisibility;
  albumId?: string;
  tag?: string;
  favorite?: boolean;
  trashed?: boolean;
  cursor?: string;
  limit?: number;
  sort?: HostedImageSort;
};

export type HostedImageSort =
  | "createdAt_desc"
  | "createdAt_asc"
  | "name_asc"
  | "name_desc";

export type HostedImagePage<T> = {
  items: T[];
  nextCursor: string | null;
};

export const HOSTED_IMAGE_SORTS: HostedImageSort[] = [
  "createdAt_desc",
  "createdAt_asc",
  "name_asc",
  "name_desc",
];

export const DEFAULT_MAX_HOSTED_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_HOSTED_IMAGE_HARD_BYTES = 100 * 1024 * 1024;
export const MAX_HOSTED_IMAGE_BATCH_SIZE = 100;
export const DEFAULT_HOSTED_IMAGE_PAGE_SIZE = 36;
export const MAX_HOSTED_IMAGE_PAGE_SIZE = 100;

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
  views: number;
};

export const IMAGE_OUTPUT_FORMATS = [
  "ORIGINAL",
  "JPEG",
  "PNG",
  "WEBP",
  "AVIF",
] as const;
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];

export const IMAGE_WATERMARK_POSITIONS = [
  "northwest",
  "north",
  "northeast",
  "west",
  "center",
  "east",
  "southwest",
  "south",
  "southeast",
] as const;
export type ImageWatermarkPosition = (typeof IMAGE_WATERMARK_POSITIONS)[number];
