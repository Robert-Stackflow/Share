import { Controller, Get, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth/auth.service";
import { ConfigService } from "./config/config.service";
import { PrismaService } from "./prisma/prisma.service";

@Controller("/")
export class AppController {
  constructor(
    private prismaService: PrismaService,
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prismaService.config.findMany();
      return "OK";
    } catch {
      res.statusCode = 500;
      return "ERROR";
    }
  }

  /** Authorization endpoint used by Caddy before serving a static page. */
  @Get("frontend-route")
  async authorizeFrontendRoute(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const forwardedUri = request.headers["x-forwarded-uri"];
    const rawUri = Array.isArray(forwardedUri) ? forwardedUri[0] : forwardedUri;
    const url = new URL(rawUri || "/", "http://frontend.local");
    const route = url.pathname.replace(/\/$/, "") || "/";
    const userId = await this.authService.getIdOfCurrentUser(request);
    const user = userId
      ? await this.prismaService.user.findUnique({ where: { id: userId } })
      : null;

    const isRoute = (pattern: string) =>
      new RegExp(`^${pattern.replace(/\*/g, ".*")}$`).test(route);
    const isAny = (patterns: string[]) => patterns.some(isRoute);
    const unauthenticated = ["/auth/*", "/"];
    const publicRoutes = [
      "/share/*",
      "/s/*",
      "/short-link-access",
      "/rooms/*",
      "/inbox/*",
      "/upload/*",
      "/error",
      "/imprint",
      "/privacy",
    ];

    const disabled =
      (route === "/auth/signUp" &&
        !this.configService.get("share.allowRegistration")) ||
      (isRoute("/auth/resetPassword*") &&
        !this.configService.get("smtp.enabled")) ||
      ((route === "/imprint" || route === "/privacy") &&
        !this.configService.get("legal.enabled"));

    let destination: string | null = disabled ? "/" : null;
    const allowAll = this.configService.get("share.allowUnauthenticatedShares");
    const isPublic = allowAll || isAny(publicRoutes);
    const isUnauthenticatedRoute = isAny(unauthenticated);

    if (!destination && user && isUnauthenticatedRoute && !allowAll) {
      destination = "/upload";
    } else if (!destination && !user && !isPublic && !isUnauthenticatedRoute) {
      destination = `/auth/signIn?redirect=${encodeURIComponent(route)}`;
    } else if (!destination && isRoute("/admin/*") && !user?.isAdmin) {
      destination = "/upload";
    } else if (
      !destination &&
      route === "/" &&
      (!this.configService.get("general.showHomePage") || user)
    ) {
      destination = "/upload";
    } else if (
      !destination &&
      route === "/imprint" &&
      !this.configService.get("legal.imprintText") &&
      this.configService.get("legal.imprintUrl")
    ) {
      destination = this.configService.get("legal.imprintUrl");
    } else if (
      !destination &&
      route === "/privacy" &&
      !this.configService.get("legal.privacyPolicyText") &&
      this.configService.get("legal.privacyPolicyUrl")
    ) {
      destination = this.configService.get("legal.privacyPolicyUrl");
    }

    if (destination) {
      response.redirect(302, destination);
      return;
    }
    response.status(204).send();
  }
}
