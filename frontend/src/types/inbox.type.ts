import { MyReverseShare } from "./share.type";
import { Asset } from "./asset.type";
import { AccessControl } from "./accessControl.type";

export type CreateInbox = {
  name?: string;
  description?: string;
  shareExpiration: string;
  maxShareSize: string;
  maxUseCount: number;
  sendEmailNotification: boolean;
  simplified: boolean;
  publicAccess: boolean;
  accessControl?: AccessControl;
};

export type Inbox = MyReverseShare;

export type PublicInbox = {
  id: string;
  name?: string;
  description?: string;
  maxShareSize: string;
  shareExpiration: Date;
  token: string;
  simplified: boolean;
};

export type CreatedInbox = {
  token: string;
  link: string;
  legacyLink: string;
};

export type CreateInboxSubmission = {
  message?: string;
  assets?: Array<
    | {
        type: "TEXT";
        content: string;
      }
    | {
        type: "LINK";
        url: string;
      }
  >;
  hasFiles?: boolean;
};

export type InboxSubmission = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  message?: string;
  reverseShareId: string;
  assets: Asset[];
  share?: {
    id: string;
  };
};
