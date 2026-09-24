import { AccessControl } from "./accessControl.type";

export type ShortLinkTargetType = "URL" | "INTERNAL_PATH";

export type ShortLink = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  code: string;
  title?: string;
  targetType: ShortLinkTargetType;
  targetUrl: string;
  isActive: boolean;
  visits: number;
  ownerId?: string;
  accessControl?: (Omit<AccessControl, "password" | "allowDownload"> & {
    passwordProtected: boolean;
    views: number;
  }) | null;
};

export type CreateShortLink = {
  targetType: ShortLinkTargetType;
  targetUrl: string;
  title?: string;
  code?: string;
  accessControl?: AccessControl;
};

export type UpdateShortLink = {
  targetType?: ShortLinkTargetType;
  targetUrl?: string;
  title?: string;
  isActive?: boolean;
  accessControl?: AccessControl;
};

export type ShortLinkVisit = {
  id: string;
  createdAt: Date | string;
  ipHash?: string;
  userAgent?: string;
  referer?: string;
};

export type ShortLinkStatsBucket = {
  label: string;
  visits: number;
};

export type ShortLinkStats = {
  code: string;
  targetType: ShortLinkTargetType;
  targetUrl: string;
  totalVisits: number;
  uniqueVisitors: number;
  lastVisitedAt?: Date | string | null;
  visitsByDay: { date: string; visits: number }[];
  visitsByReferer: ShortLinkStatsBucket[];
  visitsByUserAgent: ShortLinkStatsBucket[];
  recentVisits: ShortLinkVisit[];
};
