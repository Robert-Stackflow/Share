import { HostedImage, ImageVisibility } from "../types/image.type";
import api from "./api.service";

export type ListHostedImageParams = {
  q?: string;
  visibility?: ImageVisibility;
};

const list = async (params?: ListHostedImageParams): Promise<HostedImage[]> =>
  (await api.get("/images", { params })).data;

const upload = async (
  file: File,
  visibility: ImageVisibility,
): Promise<HostedImage> => {
  const form = new FormData();
  form.append("file", file);
  form.append("visibility", visibility);
  return (await api.post("/images", form)).data;
};

const update = async (
  id: string,
  input: { name?: string; visibility?: ImageVisibility },
): Promise<HostedImage> => (await api.patch(`/images/${id}`, input)).data;

const remove = async (id: string): Promise<void> => {
  await api.delete(`/images/${id}`);
};

export default { list, upload, update, remove };
