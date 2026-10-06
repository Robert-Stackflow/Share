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
  slug: string;
  visibility: ImageVisibility;
  width: number;
  height: number;
  checksum: string;
  name: string;
  size: string;
  mimeType: string;
  url: string | null;
  path: string | null;
  contentUrl: string;
  links: HostedImageLinks | null;
};
