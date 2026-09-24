import {
  CreateShortLink,
  ShortLink,
  ShortLinkStats,
  UpdateShortLink,
} from "../types/shortLink.type";
import api from "./api.service";

const list = async (): Promise<ShortLink[]> => {
  return (await api.get("short-links")).data;
};

const create = async (shortLink: CreateShortLink): Promise<ShortLink> => {
  return (await api.post("short-links", shortLink)).data;
};

const stats = async (code: string): Promise<ShortLinkStats> => {
  return (await api.get(`short-links/${code}/stats`)).data;
};

const update = async (
  code: string,
  shortLink: UpdateShortLink,
): Promise<ShortLink> => {
  return (await api.patch(`short-links/${code}`, shortLink)).data;
};

const remove = async (code: string) => {
  await api.delete(`short-links/${code}`);
};

export type ShortLinkAccessStatus = {
  title?: string | null;
  status: "active" | "disabled" | "expired" | "limit";
  requiresPassword: boolean;
  requiresSignIn: boolean;
};

const access = async (code: string): Promise<ShortLinkAccessStatus> =>
  (await api.get(`short-links/${encodeURIComponent(code)}/access`)).data;

const resolve = async (code: string, password?: string): Promise<string> =>
  (await api.post(`short-links/${encodeURIComponent(code)}/resolve`, { password })).data.targetUrl;

export default {
  list,
  create,
  stats,
  update,
  remove,
  access,
  resolve,
};
