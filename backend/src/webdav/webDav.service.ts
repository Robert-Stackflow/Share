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
import { StorageObject } from "src/storage/storage.types";
import { StorageService } from "src/storage/storage.service";
import { StorageProvider } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "src/prisma/prisma.service";

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
    private readonly prisma: PrismaService,
    private readonly storage?: StorageService,
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
        const provider =
          this.storage?.getConfiguredProvider() ??
          (this.config.get("s3.enabled")
            ? StorageProvider.S3
            : StorageProvider.LOCAL);
        if (provider !== StorageProvider.S3) {
          response.status(503).send("WebDAV requires S3 storage to be enabled");
          return;
        }
        if (
          request.method.toUpperCase() === "MOVE" &&
          request.get("Overwrite")?.toUpperCase() === "F"
        ) {
          void this.handleExclusiveMove(request, response, next, server);
          return;
        }
        if (request.method.toUpperCase() === "PUT") {
          void this.handleSmallPut(request, response, next, server);
          return;
        }
        server(request, response, next);
      };
    }

    return this.middlewareInstance;
  }

  private async handleSmallPut(
    request: Request,
    response: Response,
    next: Parameters<RequestHandler>[2],
    server: RequestHandler,
  ): Promise<void> {
    try {
      const authentication = await this.tryAuthenticate(
        request,
        response.locals as WebDavLocals,
      );
      if (
        !authentication ||
        !(await this.tryFastSmallPut(request, response, authentication.user.id))
      ) {
        server(request, response, next);
      }
    } catch (error) {
      next(error);
    }
  }

  private async tryFastSmallPut(
    request: Request,
    response: Response,
    userId: string,
  ): Promise<boolean> {
    const length = Number(request.get("Content-Length"));
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > 64 * 1024 ||
      !request.get("Content-Length") ||
      request.get("Transfer-Encoding") ||
      request.get("Content-Encoding") ||
      request.get("Content-Range") ||
      request.get("Content-Language") ||
      [
        "If",
        "If-Match",
        "If-None-Match",
        "If-Modified-Since",
        "If-Unmodified-Since",
        "Lock-Token",
      ].some((header) => request.get(header))
    ) {
      return false;
    }

    let url: URL;
    let pathname: string;
    try {
      url = new URL(
        request.originalUrl,
        `${request.protocol}://${request.get("host") ?? "localhost"}`,
      );
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return false;
    }
    if (
      !pathname.startsWith("/dav/") ||
      pathname.endsWith("/") ||
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.split("/").some((part) => part === "." || part === "..")
    ) {
      return false;
    }
    const relative = pathname.slice(5);
    const parent = relative.slice(0, relative.lastIndexOf("/"));
    if (!parent || relative.split("/").length > 8) return false;

    const root = this.objects.webDavRootKey(userId);
    const key = `${root}/${relative}`;
    const [parentContents, collectionContents, existing] = await Promise.all([
      this.objects.list(`${root}/${parent}/`, { maxKeys: 1 }),
      this.objects.list(`${key}/`, { maxKeys: 1 }),
      this.headWebDavObject(key),
    ]);
    if (!parentContents.objects.length || collectionContents.objects.length)
      return false;

    const lockKeys = [key];
    for (
      let path = parent;
      path;
      path = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
    ) {
      lockKeys.push(`${root}/${path}`, `${root}/${path}/.nepheleempty`);
    }
    if (await this.hasWebDavLocks(lockKeys, existing)) return false;

    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 64 * 1024) {
        response.status(413).end("WebDAV upload exceeds the fast path limit");
        return true;
      }
      chunks.push(buffer);
    }
    await this.objects.put(key, Buffer.concat(chunks), {
      contentType: request.get("Content-Type")?.split(";")[0],
      metadata: existing?.metadata ?? {
        "nephele-properties": "{}",
        "nephele-locks": "{}",
      },
    });
    response.set({
      "Cache-Control": "private, no-cache",
      Date: new Date().toUTCString(),
    });
    if (existing) {
      response.status(204).end();
    } else {
      response.status(201).set("Location", url.toString()).end();
    }
    return true;
  }

  private async handleExclusiveMove(
    request: Request,
    response: Response,
    next: Parameters<RequestHandler>[2],
    server: RequestHandler,
  ): Promise<void> {
    try {
      const authentication = await this.tryAuthenticate(
        request,
        response.locals as WebDavLocals,
      );
      const destination = request.get("Destination");
      if (!authentication || !destination) {
        server(request, response, next);
        return;
      }

      // The destination, not the source, is the resource all contenders must
      // agree on. A unique DB row serializes them across Share processes using
      // the same database; URL host aliases still map to the same DAV path.
      let path: string;
      try {
        const base = `${request.protocol}://${request.get("host") ?? "localhost"}`;
        path = decodeURIComponent(new URL(destination, base).pathname)
          .normalize("NFC")
          .replace(/\/+$/, "");
      } catch {
        server(request, response, next);
        return;
      }
      const id = createHash("sha256")
        .update(`${authentication.user.id}\0${path}`)
        .digest("hex");
      const owner = randomUUID();
      let reserved = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await this.prisma.webDavMoveReservation.create({
            data: { id, owner },
          });
          reserved = true;
          break;
        } catch (error) {
          if ((error as { code?: string }).code !== "P2002") throw error;
          // The previous response can reach a client just before its finish
          // handler removes the row. Retry briefly so the next MOVE can see
          // the actual destination state instead of a stale 423.
          if (attempt < 19) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      }
      if (!reserved) {
        response.status(423).end("WebDAV destination is busy");
        return;
      }

      let delegated = false;
      try {
        // Nephele checks every descendant through S3 when moving a collection.
        // A small, unlocked sibling collection can be copied with a bounded
        // number of S3 requests instead. This matters for DAV lock candidates:
        // clients commonly time out before Nephele's recursive MOVE finishes.
        if (
          await this.tryFastExclusiveCollectionMove(
            request,
            response,
            authentication.user.id,
            destination,
          )
        ) {
          return;
        }

        delegated = true;
        // For moves handled by Nephele, only a completed response proves its
        // recursive S3 operation has stopped.
        response.once("finish", () => {
          void this.prisma.webDavMoveReservation
            .deleteMany({ where: { id, owner } })
            .catch((error) =>
              this.logger.error(
                "Could not release WebDAV MOVE reservation",
                error,
              ),
            );
        });
        server(request, response, next);
      } finally {
        // The fast path is awaited even if the client disconnects. Its storage
        // work has stopped here, so it cannot leave a permanent reservation.
        if (!delegated) {
          await this.prisma.webDavMoveReservation.deleteMany({
            where: { id, owner },
          });
        }
      }
    } catch (error) {
      next(error);
    }
  }

  private async tryFastExclusiveCollectionMove(
    request: Request,
    response: Response,
    userId: string,
    destination: string,
  ): Promise<boolean> {
    const baseUrl = `${request.protocol}://${request.get("host") ?? "localhost"}`;
    let sourceUrl: URL;
    let destinationUrl: URL;
    try {
      sourceUrl = new URL(request.originalUrl, baseUrl);
      destinationUrl = new URL(destination, baseUrl);
    } catch {
      return false;
    }
    if (
      sourceUrl.host !== destinationUrl.host ||
      !sourceUrl.pathname.endsWith("/") ||
      !destinationUrl.pathname.endsWith("/") ||
      [
        "If",
        "If-Match",
        "If-None-Match",
        "If-Modified-Since",
        "If-Unmodified-Since",
        "Lock-Token",
      ].some((header) => request.get(header))
    ) {
      return false;
    }

    let sourcePath: string;
    let destinationPath: string;
    try {
      sourcePath = decodeURIComponent(sourceUrl.pathname);
      destinationPath = decodeURIComponent(destinationUrl.pathname);
    } catch {
      return false;
    }
    const valid = (path: string) =>
      path.startsWith("/dav/") &&
      !path.includes("\\") &&
      !path.includes("\0") &&
      !path.split("/").some((part) => part === "." || part === "..");
    if (!valid(sourcePath) || !valid(destinationPath)) return false;

    const sourceRelative = sourcePath.slice(5, -1);
    const destinationRelative = destinationPath.slice(5, -1);
    const parent = (path: string) =>
      path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (
      !sourceRelative ||
      !destinationRelative ||
      sourceRelative === destinationRelative ||
      parent(sourceRelative) !== parent(destinationRelative)
    ) {
      return false;
    }

    // Proxies can forward an empty MOVE with chunked framing. Check the
    // actual stream instead of delegating it to a recursive MOVE that may
    // partly move the lock candidate before returning 207.
    for await (const chunk of request) {
      if (chunk.length) {
        response.status(415).end("WebDAV MOVE request body is unsupported");
        return true;
      }
    }

    const root = this.objects.webDavRootKey(userId);
    const sourceKey = `${root}/${sourceRelative}`;
    const destinationKey = `${root}/${destinationRelative}`;
    const [
      initialSource,
      destinationCollection,
      destinationFile,
      sourceDirect,
    ] = await Promise.all([
      this.objects.list(`${sourceKey}/`, { maxKeys: 9 }),
      this.objects.list(`${destinationKey}/`, { maxKeys: 1 }),
      this.headWebDavObject(destinationKey),
      this.headWebDavObject(sourceKey),
    ]);
    let source = initialSource;
    if (destinationCollection.objects.length || destinationFile) {
      response.status(412).end("A resource exists at the destination");
      return true;
    }
    // Freshly created S3 collections may take a moment to appear in a LIST.
    // Do not send a small, exclusive MOVE to Nephele while its source tree is
    // still uncertain: recursive MOVE can partly copy and respond 207.
    for (let attempt = 0; !source.objects.length && attempt < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      source = await this.objects.list(`${sourceKey}/`, { maxKeys: 9 });
    }
    if (!source.objects.length) {
      this.logger.warn("WebDAV exclusive MOVE source was not visible in S3");
      response.status(409).end("WebDAV source collection is not yet visible");
      return true;
    }
    if (source.continuationToken) return false;
    if (sourceDirect) {
      this.logger.warn("WebDAV exclusive MOVE source has a direct S3 object");
      return false;
    }

    // A fast move must not bypass WebDAV lock checks. Inspect the collection's
    // objects and its ancestors before copying anything.
    const parentKeys: string[] = [];
    for (let path = parent(sourceRelative); path; path = parent(path)) {
      parentKeys.push(`${root}/${path}`, `${root}/${path}/.nepheleempty`);
    }
    parentKeys.push(`${root}/.nepheleempty`);
    if (
      await this.hasWebDavLocks([
        ...source.objects.map((object) => object.key),
        ...parentKeys,
      ])
    ) {
      response.status(423).end("WebDAV source or parent is locked");
      return true;
    }

    await Promise.all(
      source.objects.map((object) =>
        this.objects.copy(
          object.key,
          `${destinationKey}/${object.key.slice(sourceKey.length + 1)}`,
        ),
      ),
    );
    // Some S3-compatible providers reject DeleteObjects without Content-MD5.
    // This path is bounded to at most nine objects, so individual deletes are
    // both compatible and inexpensive.
    await Promise.all(
      source.objects.map((object) => this.objects.delete(object.key)),
    );
    response.status(201).set("Location", destinationUrl.toString()).end();
    return true;
  }

  private async headWebDavObject(key: string): Promise<StorageObject | null> {
    try {
      return await this.objects.head(key);
    } catch (error) {
      const s3Error = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        s3Error.$metadata?.httpStatusCode === 404 ||
        s3Error.name === "NotFound" ||
        s3Error.name === "NoSuchKey"
      )
        return null;
      throw error;
    }
  }

  private async hasWebDavLocks(
    keys: string[],
    known?: StorageObject | null,
  ): Promise<boolean> {
    const metadata = await Promise.all(
      [...new Set(keys)].map((key) =>
        known?.key === key
          ? Promise.resolve(known.metadata)
          : this.headWebDavObject(key).then((object) => object?.metadata),
      ),
    );
    return metadata.some((entry) => {
      try {
        return (
          Object.keys(JSON.parse(entry?.["nephele-locks"] ?? "{}")).length > 0
        );
      } catch {
        return true;
      }
    });
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
    const root = this.objects.resolveKey(this.objects.webDavRootKey(userId));
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
    const root = this.objects.webDavRootKey(userId);
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
