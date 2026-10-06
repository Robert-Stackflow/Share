export type ImageVisibility = "PUBLIC" | "PRIVATE";

export type HostedImageLinks = {
  direct: string;
  markdown: string;
  html: string;
  bbcode: string;
};

export type HostedImage = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  slug: string;
  visibility: ImageVisibility;
  width: number;
  height: number;
  checksum: string;
  name: string;
  size: string;
  mimeType: string;
  favorite: boolean;
  tags: string[];
  views: number;
  lastViewedAt: string | null;
  album: { id: string; name: string } | null;
  url: string | null;
  path: string | null;
  contentUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
  hasOriginal: boolean;
  thumbnail: {
    width: number;
    height: number;
    size: string;
    mimeType: string;
  } | null;
  links: HostedImageLinks | null;
  owner?: { id: string; username: string; email: string } | null;
};

export type HostedImagePage = {
  items: HostedImage[];
  nextCursor: string | null;
};

export type HostedImageStats = {
  count: number;
  publicCount: number;
  privateCount: number;
  totalSize: number;
  views: number;
};

export type ImageAlbum = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string | null;
  imageCount: number;
  coverImageId: string | null;
  coverUrl: string | null;
};

export type ImageOutputFormat = "ORIGINAL" | "JPEG" | "PNG" | "WEBP" | "AVIF";

export type ImagePreference = {
  userId: string;
  defaultVisibility: ImageVisibility;
  autoOrient: boolean;
  stripMetadata: boolean;
  outputFormat: ImageOutputFormat;
  quality: number;
  maxWidth: number | null;
  deduplicate: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  watermarkOpacity: number;
  watermarkPosition: string;
};
