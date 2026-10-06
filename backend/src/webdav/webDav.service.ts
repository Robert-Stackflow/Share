import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import S3Adapter from "@nephele/adapter-s3";
import { Request, RequestHandler, Response } from "express";
import createWebDavServer, {
  Authenticator,
  ForbiddenError,
  UnauthorizedError,
  User as WebDavUser,
} from "nephele";
import { AppCredentialService } from "src/appCredential/appCredential.service";
import { ConfigService } from "src/config/config.service";
import { S3ObjectStorageService } from "src/storage/s3ObjectStorage.service";

type WebDavAuthentication = Awaited<
  ReturnType<AppCredentialService["authenticateWebDav"]>
>;

type WebDavLocals = {
  shareDavAuthAttempted?: boolean;
  shareDavAuthentication?: WebDavAuthentication;
  shareDavAuthenticationError?: unknown;
};

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PROPFIND"]);

@Injectable()
export class WebDavService {
  private readonly logger = new Logger(WebDavService.name);
  private readonly adapters = new Map<
    string,
    { signature: string; adapter: S3Adapter }
  >();
  private readonly rootInitializationRequests = new Map<
    string,
    { signature: string; promise: Promise<void> }
  >();
  private middlewareInstance?: RequestHandler;

  constructor(
    private readonly credentials: AppCredentialService,
    private readonly config: ConfigService,
    private readonly objects: S3ObjectStorageService,
  ) {}

  middleware(): RequestHandler {
    if (!this.middlewareInstance) {
      const server = createWebDavServer(
        {
          adapter: async (request, response) => {
            if (request.method === "OPTIONS") {
              return this.getAdapter("_options");
            }
            const authentication = await this.tryAuthenticate(
              request,
              response.locals as WebDavLocals,
            );
            const userId = authentication?.user.id ?? "_unauthorized";
            if (authentication) {
              await this.ensureUserRoot(userId);
            }
            return this.getAdapter(userId);
          },
          authenticator: this.createAuthenticator(),
        },
        {
          compression: false,
          errorHandler: async (code, message, _request, response, error) => {
            if (code >= 500 && error) {
              this.logger.error(error);
            }
            if (response.headersSent || response.destroyed) {
              response.end();
              return;
            }
            const body = `WebDAV ${code}: ${message}`;
            response.status(code);
            response.set({
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Length": Buffer.byteLength(body).toString(),
            });
            response.end(body);
          },
        },
      );

      this.middlewareInstance = (request, response, next) => {
        if (!this.config.get("webdav.enabled")) {
          response.status(503).send("WebDAV is disabled by the administrator");
          return;
        }
        if (
          !READ_METHODS.has(request.method.toUpperCase()) &&
          !this.config.get("webdav.allowWrite")
        ) {
          response
            .status(403)
            .send("WebDAV write access is disabled by the administrator");
          return;
        }
        if (!this.config.get("s3.enabled")) {
          response.status(503).send("WebDAV requires S3 storage to be enabled");
          return;
        }
        server(request, response, next);
      };
    }

    return this.middlewareInstance;
  }

  private createAuthenticator(): Authenticator {
    return {
      authenticate: async (request, response): Promise<WebDavUser> => {
        const locals = response.locals as unknown as WebDavLocals;
        const authentication = await this.tryAuthenticate(request, locals);
        if (!authentication) {
          if (
            locals.shareDavAuthenticationError instanceof ForbiddenException
          ) {
            throw new ForbiddenError(
              "Credential does not allow this operation",
            );
          }
          response.set(
            "WWW-Authenticate",
            'Basic realm="Share WebDAV", charset="UTF-8"',
          );
          throw new UnauthorizedError("Invalid WebDAV credentials");
        }

        return { username: authentication.user.id };
      },
      cleanAuthentication: async () => undefined,
    };
  }

  private async tryAuthenticate(
    request: Request,
    locals: WebDavLocals,
  ): Promise<WebDavAuthentication | null> {
    if (locals.shareDavAuthAttempted) {
      return locals.shareDavAuthentication ?? null;
    }
    locals.shareDavAuthAttempted = true;

    const parsed = this.parseBasicAuthentication(request);
    if (!parsed) return null;

    try {
      const authentication = await this.credentials.authenticateWebDav(
        parsed.username,
        parsed.password,
        !READ_METHODS.has(request.method.toUpperCase()),
      );
      locals.shareDavAuthentication = authentication;
      return authentication;
    } catch (error) {
      locals.shareDavAuthenticationError = error;
      return null;
    }
  }

  private parseBasicAuthentication(
    request: Request,
  ): { username: string; password: string } | null {
    const authorization = request.headers.authorization ?? "";
    const [scheme, encoded] = authorization.split(" ", 2);
    if (scheme?.toLowerCase() !== "basic" || !encoded) return null;

    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator < 1) return null;
      const username = decoded.slice(0, separator);
      const password = decoded.slice(separator + 1);
      return password ? { username, password } : null;
    } catch {
      return null;
    }
  }

  private getAdapter(userId: string): S3Adapter {
    const s3Config = this.objects.getS3ClientConfig();
    const bucket = this.objects.getBucketName();
    const root = this.objects.resolveKey(`dav/${userId}`);
    const signature = JSON.stringify({ s3Config, bucket, root });
    const cached = this.adapters.get(userId);
    if (cached?.signature === signature) return cached.adapter;

    cached?.adapter.s3.destroy();
    const adapter = new S3Adapter({
      s3Config,
      bucket,
      root,
      uploadQueueSize: 2,
    });
    this.adapters.set(userId, { signature, adapter });
    return adapter;
  }

  private async ensureUserRoot(userId: string): Promise<void> {
    const root = `dav/${userId}`;
    const signature = JSON.stringify({
      s3Config: this.objects.getS3ClientConfig(),
      bucket: this.objects.getBucketName(),
      root: this.objects.resolveKey(root),
    });
    const cached = this.rootInitializationRequests.get(userId);
    if (cached?.signature === signature) {
      return cached.promise;
    }

    const promise = (async () => {
      const contents = await this.objects.list(`${root}/`, { maxKeys: 1 });
      if (!contents.objects.length && !contents.prefixes.length) {
        await this.objects.put(`${root}/.nepheleempty`, Buffer.alloc(0));
      }
    })();

    this.rootInitializationRequests.set(userId, { signature, promise });
    try {
      await promise;
    } finally {
      if (this.rootInitializationRequests.get(userId)?.promise === promise) {
        this.rootInitializationRequests.delete(userId);
      }
    }
  }
}
