import { AccessControl } from "./accessControl.type";
import { Asset, CreateAsset } from "./asset.type";

export type Room = {
  id: string;
  createdAt: string;
  updatedAt: string;
  roomId: string;
  visibility: "PRIVATE" | "SHARED";
  name?: string | null;
  ownerId?: string | null;
  hasPasscode: boolean;
  accessControl?: (AccessControl & { views?: number }) | null;
  assets: Asset[];
};

export type CreateRoom = {
  name?: string;
  passcode?: string;
  accessControl?: AccessControl;
};

export type UpdateRoom = {
  name?: string | null;
  passcode?: string | null;
  accessControl?: AccessControl;
};

export type CreateRoomAsset = CreateAsset;
