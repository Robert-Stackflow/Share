import { Readable } from "stream";

export type StorageChunk = {
  index: number;
  total: number;
};

export type StorageObject = {
  key: string;
  size: number;
  etag?: string;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
};

export type StorageObjectStream = StorageObject & {
  body: Readable;
  contentRange?: string;
};

export type StorageListResult = {
  objects: StorageObject[];
  prefixes: string[];
  continuationToken?: string;
};
