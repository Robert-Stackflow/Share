export type AppCredentialType = "APP_PASSWORD" | "API_TOKEN";

export type AppCredentialScope =
  | "webdav:read"
  | "webdav:write"
  | "image:read"
  | "image:write";

export type AppCredential = {
  id: string;
  name: string;
  type: AppCredentialType;
  tokenHint: string;
  scopes: AppCredentialScope[];
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type CreateAppCredential = {
  name: string;
  type: AppCredentialType;
  scopes: AppCredentialScope[];
  expiresAt?: string;
};

export type CreatedAppCredential = {
  credential: AppCredential;
  token: string;
  username: string;
};
