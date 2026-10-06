import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AppCredentialService } from "./appCredential.service";
import {
  APP_CREDENTIAL_SCOPES_KEY,
  AppCredentialScope,
} from "./appCredential.types";

@Injectable()
export class AppCredentialGuard implements CanActivate {
  constructor(
    private readonly credentials: AppCredentialService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization ?? "";
    const [scheme, token] = authorization.split(" ", 2);
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Bearer API token is required");
    }

    const scopes =
      this.reflector.getAllAndOverride<AppCredentialScope[]>(
        APP_CREDENTIAL_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    const authenticated = await this.credentials.authenticate(token, scopes);
    request.user = authenticated.user;
    (request as Request & { appCredential?: unknown }).appCredential =
      authenticated.credential;
    return true;
  }
}
