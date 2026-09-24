import api from "./api.service";
import { Asset } from "../types/asset.type";
import { FileUploadResponse } from "../types/File.type";
import {
  CreateRoom,
  CreateRoomAsset,
  Room,
  UpdateRoom,
} from "../types/room.type";

const list = async (): Promise<Room[]> => (await api.get("rooms")).data;
const getOwned = async (id: string): Promise<Room> =>
  (await api.get(`rooms/${id}/owner`)).data;
const get = async (id: string): Promise<Room> =>
  (await api.get(`rooms/${id}`)).data;
const create = async (room: CreateRoom): Promise<Room> =>
  (await api.post("rooms", room)).data;
const update = async (id: string, room: UpdateRoom): Promise<Room> =>
  (await api.patch(`rooms/${id}`, room)).data;
const remove = async (id: string) => {
  await api.delete(`rooms/${id}`);
};
const verify = async (id: string, passcode?: string) =>
  (await api.post(`rooms/${id}/verify`, { passcode })).data;
const addAsset = async (id: string, asset: CreateRoomAsset): Promise<Asset> =>
  (await api.post(`rooms/${id}/assets`, asset)).data;
const uploadFile = async (
  id: string,
  chunk: Blob,
  file: { id?: string; name: string },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse & Partial<Asset>> =>
  (
    await api.post(`rooms/${id}/assets`, chunk, {
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
const downloadFileUrl = (id: string, assetId: string) =>
  `${window.location.origin}/api/rooms/${id}/assets/${assetId}/download`;
const removeAsset = async (id: string, assetId: string) => {
  await api.delete(`rooms/${id}/assets/${assetId}`);
};
const eventsUrl = (id: string) => `/api/rooms/${id}/events`;
const listEventsUrl = "/api/rooms/events";
const ownedEventsUrl = (id: string) => `/api/rooms/${id}/owner/events`;

export default {
  list,
  getOwned,
  get,
  create,
  update,
  remove,
  verify,
  addAsset,
  uploadFile,
  downloadFileUrl,
  removeAsset,
  eventsUrl,
  listEventsUrl,
  ownedEventsUrl,
};
