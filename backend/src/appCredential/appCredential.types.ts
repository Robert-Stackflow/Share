import { SetMetadata } from "@nestjs/common";
import { AppCredentialType } from "@prisma/client";

export { AppCredentialType };

export enum AppCredentialScope {
  WEBDAV_READ = "webdav:read",
  WEBDAV_WRITE = "webdav:write",
  IMAGE_READ = "image:read",
  IMAGE_WRITE = "image:write",
}

export const APP_CREDENTIAL_SCOPES: Record<
  AppCredentialType,
  AppCredentialScope[]
> = {
  APP_PASSWORD: [
    AppCredentialScope.WEBDAV_READ,
    AppCredentialScope.WEBDAV_WRITE,
  ],
  API_TOKEN: [AppCredentialScope.IMAGE_READ, AppCredentialScope.IMAGE_WRITE],
};

export const APP_CREDENTIAL_SCOPES_KEY = "app-credential-scopes";
export const RequireAppCredentialScopes = (...scopes: AppCredentialScope[]) =>
  SetMetadata(APP_CREDENTIAL_SCOPES_KEY, scopes);
