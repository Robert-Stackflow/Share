import { FileUploadResponse } from "../types/File.type";
import {
  Asset,
  AssetSource,
  AssetTagSummary,
  AssetType,
  CreateAsset,
} from "../types/asset.type";
import { ShortLink } from "../types/shortLink.type";
import api from "./api.service";

export type UpdateAsset = {
  content?: string;
  url?: string;
  name?: string;
  favorite?: boolean;
  tags?: string[];
};

export type ListAssetParams = {
  q?: string;
  type?: AssetType;
  source?: AssetSource;
  favorite?: boolean;
  tag?: string;
  sort?: string;
};

export type AssetShareResult = {
  share: {
    id: string;
  };
  asset: Asset;
};

type RawAsset = Omit<Asset, "tags"> & {
  tagAssignments?: { tag: { id: string; name: string } }[];
};

const mapAsset = (raw: RawAsset): Asset => {
  const { tagAssignments, ...rest } = raw;
  return {
    ...rest,
    tags: (tagAssignments ?? []).map((assignment) => assignment.tag),
  };
};

const list = async (params?: ListAssetParams): Promise<Asset[]> => {
  const data: RawAsset[] = (await api.get("assets", { params })).data;
  return data.map(mapAsset);
};

const listTags = async (): Promise<AssetTagSummary[]> => {
  return (await api.get("assets/tags")).data;
};

const create = async (asset: CreateAsset): Promise<Asset> => {
  return mapAsset((await api.post("assets", asset)).data);
};

const remove = async (id: string) => {
  await api.delete(`assets/${id}`);
};

const update = async (id: string, asset: UpdateAsset): Promise<Asset> => {
  return mapAsset((await api.patch(`assets/${id}`, asset)).data);
};

const clone = async (id: string): Promise<Asset> => {
  return mapAsset((await api.post(`assets/${id}/clone`)).data);
};

const saveToLibrary = async (id: string): Promise<Asset> => {
  return mapAsset((await api.post(`assets/${id}/save-to-library`)).data);
};

const createShare = async (id: string): Promise<AssetShareResult> => {
  return (await api.post(`assets/${id}/share`)).data;
};

const createShortLink = async (id: string): Promise<ShortLink> => {
  return (await api.post(`assets/${id}/short-link`)).data;
};

const sendToRoom = async (id: string, roomId: string): Promise<Asset> => {
  return (await api.post(`assets/${id}/send-to-room`, { roomId })).data;
};

const downloadFileUrl = (id: string) => {
  return `/api/assets/${id}/download`;
};

const downloadFile = (id: string) => {
  window.location.href = downloadFileUrl(id);
};

const uploadFile = async (
  chunk: Blob,
  file: {
    id?: string;
    name: string;
  },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse & Partial<Asset>> => {
  return (
    await api.post("assets", chunk, {
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        type: "FILE",
        id: file.id,
        name: file.name,
        chunkIndex,
        totalChunks,
      },
    })
  ).data;
};

export default {
  list,
  listTags,
  create,
  remove,
  update,
  clone,
  saveToLibrary,
  createShare,
  createShortLink,
  sendToRoom,
  downloadFileUrl,
  downloadFile,
  uploadFile,
};
