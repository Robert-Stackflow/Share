import {
  AppCredential,
  CreateAppCredential,
  CreatedAppCredential,
} from "../types/appCredential.type";
import api from "./api.service";

const list = async (): Promise<AppCredential[]> =>
  (await api.get("/app-credentials")).data;

const create = async (
  input: CreateAppCredential,
): Promise<CreatedAppCredential> =>
  (await api.post("/app-credentials", input)).data;

const revoke = async (id: string): Promise<AppCredential> =>
  (await api.delete(`/app-credentials/${id}`)).data;

export default { list, create, revoke };
