import { setCookie } from "cookies-next";
import {
  CreateInbox,
  CreateInboxSubmission,
  CreatedInbox,
  Inbox,
  InboxSubmission,
  PublicInbox,
} from "../types/inbox.type";
import { FileUploadResponse } from "../types/File.type";
import api from "./api.service";

const isValidId = (id: string) => {
  return /^[a-zA-Z0-9-]+$/.test(id);
};

const create = async (inbox: CreateInbox): Promise<CreatedInbox> => {
  return (await api.post("inboxes", inbox)).data;
};

const list = async (): Promise<Inbox[]> => {
  return (await api.get("inboxes")).data;
};

const getByToken = async (inboxToken: string): Promise<PublicInbox> => {
  if (!isValidId(inboxToken)) throw new Error("Invalid Inbox Token");
  return (await api.get(`inboxes/${inboxToken}`)).data;
};

const setInbox = async (inboxToken: string) => {
  const inbox = await getByToken(inboxToken);
  setCookie("reverse_share_token", inboxToken);
  return inbox;
};

const remove = async (id: string) => {
  if (!isValidId(id)) throw new Error("Invalid ID");
  await api.delete(`inboxes/${id}`);
};

const createSubmission = async (
  inboxToken: string,
  submission: CreateInboxSubmission,
): Promise<InboxSubmission> => {
  if (!isValidId(inboxToken)) throw new Error("Invalid Inbox Token");
  return (await api.post(`inboxes/${inboxToken}/submissions`, submission)).data;
};

const uploadSubmissionFile = async (
  inboxToken: string,
  submissionId: string,
  chunk: Blob,
  file: {
    id?: string;
    name: string;
  },
  chunkIndex: number,
  totalChunks: number,
): Promise<FileUploadResponse> => {
  if (!isValidId(inboxToken)) throw new Error("Invalid Inbox Token");
  if (!isValidId(submissionId)) throw new Error("Invalid Submission ID");
  return (
    await api.post(
      `inboxes/${inboxToken}/submissions/${submissionId}/files`,
      chunk,
      {
        headers: { "Content-Type": "application/octet-stream" },
        params: {
          id: file.id,
          name: file.name,
          chunkIndex,
          totalChunks,
        },
      },
    )
  ).data;
};

const completeSubmission = async (inboxToken: string, submissionId: string) => {
  if (!isValidId(inboxToken) || !isValidId(submissionId)) {
    throw new Error("Invalid inbox submission");
  }
  return (
    await api.post(`inboxes/${inboxToken}/submissions/${submissionId}/complete`)
  ).data;
};

const cancelSubmission = async (inboxToken: string, submissionId: string) => {
  if (!isValidId(inboxToken) || !isValidId(submissionId)) {
    throw new Error("Invalid inbox submission");
  }
  return (
    await api.post(`inboxes/${inboxToken}/submissions/${submissionId}/cancel`)
  ).data;
};

const listSubmissions = async (inboxId: string): Promise<InboxSubmission[]> => {
  if (!isValidId(inboxId)) throw new Error("Invalid Inbox ID");
  return (await api.get(`inboxes/${inboxId}/submissions`)).data;
};

const acceptSubmission = async (
  submissionId: string,
  createShare = false,
  roomId?: string,
): Promise<InboxSubmission> => {
  if (!isValidId(submissionId)) throw new Error("Invalid Submission ID");
  return (
    await api.post(`inbox-submissions/${submissionId}/accept`, {
      createShare,
      roomId,
    })
  ).data;
};

const rejectSubmission = async (
  submissionId: string,
): Promise<InboxSubmission> => {
  if (!isValidId(submissionId)) throw new Error("Invalid Submission ID");
  return (await api.post(`inbox-submissions/${submissionId}/reject`)).data;
};

export default {
  create,
  list,
  getByToken,
  setInbox,
  remove,
  createSubmission,
  uploadSubmissionFile,
  completeSubmission,
  cancelSubmission,
  listSubmissions,
  acceptSubmission,
  rejectSubmission,
};
