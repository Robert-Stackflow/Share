import {
  HostedImage,
  HostedImagePage,
  HostedImageStats,
  ImageAlbum,
  ImagePreference,
  ImageVisibility,
} from "../types/image.type";
import api from "./api.service";

export type ListHostedImageParams = {
  q?: string;
  visibility?: ImageVisibility;
  albumId?: string;
  tag?: string;
  favorite?: boolean;
  trashed?: boolean;
  cursor?: string;
  limit?: number;
  sort?: "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc";
};

const list = async (params?: ListHostedImageParams): Promise<HostedImagePage> =>
  (await api.get("/images", { params })).data;

const stats = async (): Promise<HostedImageStats> =>
  (await api.get("/images/stats")).data;

const upload = async (
  file: File,
  visibility: ImageVisibility,
  albumId?: string,
): Promise<HostedImage> => {
  const form = new FormData();
  form.append("file", file);
  form.append("visibility", visibility);
  if (albumId) form.append("albumId", albumId);
  return (await api.post("/images", form)).data;
};

const update = async (
  id: string,
  input: {
    name?: string;
    visibility?: ImageVisibility;
    albumId?: string | null;
    favorite?: boolean;
    tags?: string[];
  },
): Promise<HostedImage> => (await api.patch(`/images/${id}`, input)).data;

const remove = async (id: string): Promise<void> => {
  await api.delete(`/images/${id}`);
};

const updateBatch = async (
  ids: string[],
  input: { visibility?: ImageVisibility; albumId?: string | null },
): Promise<HostedImage[]> =>
  (await api.patch("/images/batch", { ids, ...input })).data;

const removeBatch = async (ids: string[]): Promise<number> =>
  (await api.delete("/images/batch", { data: { ids } })).data.deleted;

const restore = async (id: string): Promise<HostedImage> =>
  (await api.post(`/images/${id}/restore`)).data;

const restoreBatch = async (ids: string[]): Promise<number> =>
  (await api.post("/images/batch/restore", { ids })).data.restored;

const destroy = async (id: string): Promise<void> => {
  await api.delete(`/images/${id}/permanent`);
};

const listAlbums = async (): Promise<ImageAlbum[]> =>
  (await api.get("/image-albums")).data;

const createAlbum = async (input: {
  name: string;
  description?: string;
}): Promise<ImageAlbum> => (await api.post("/image-albums", input)).data;

const updateAlbum = async (
  id: string,
  input: { name?: string; description?: string },
): Promise<ImageAlbum> => (await api.patch(`/image-albums/${id}`, input)).data;

const removeAlbum = async (id: string): Promise<void> => {
  await api.delete(`/image-albums/${id}`);
};

const getPreferences = async (): Promise<ImagePreference> =>
  (await api.get("/images/preferences")).data;

const updatePreferences = async (
  input: Partial<ImagePreference>,
): Promise<ImagePreference> =>
  (await api.patch("/images/preferences", input)).data;

const adminList = async (
  params?: ListHostedImageParams & { ownerId?: string },
): Promise<HostedImagePage> =>
  (await api.get("/admin/images", { params })).data;

const adminStats = async (): Promise<HostedImageStats & { users: number }> =>
  (await api.get("/admin/images/stats")).data;

const adminRemove = async (id: string): Promise<void> => {
  await api.delete(`/admin/images/${id}`);
};

export default {
  list,
  stats,
  upload,
  update,
  updateBatch,
  remove,
  removeBatch,
  restore,
  restoreBatch,
  destroy,
  listAlbums,
  createAlbum,
  updateAlbum,
  removeAlbum,
  getPreferences,
  updatePreferences,
  adminList,
  adminStats,
  adminRemove,
};
