export type AssetType = "FILE" | "TEXT" | "LINK";

export type AssetSource = "UPLOAD" | "SHARE" | "ROOM" | "INBOX";

export type AssetTag = {
  id: string;
  name: string;
};

export type Asset = {
  id: string;
  createdAt: Date;
  type: AssetType;
  ownerId?: string;
  shareId?: string;
  roomId?: string;
  roomBatchId?: string | null;
  name?: string;
  size?: string;
  mimeType?: string;
  storage?: "LOCAL" | "S3";
  content?: string;
  url?: string;
  favorite?: boolean;
  source?: AssetSource;
  lastAccessedAt?: string;
  tags?: AssetTag[];
};

export type AssetTagSummary = {
  id: string;
  name: string;
  _count: { assignments: number };
};

export type CreateTextAsset = {
  type: "TEXT";
  content: string;
};

export type CreateLinkAsset = {
  type: "LINK";
  url: string;
};

export type CreateAsset = CreateTextAsset | CreateLinkAsset;
