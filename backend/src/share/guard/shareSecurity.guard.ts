import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import * as moment from "moment";
import { I18nService } from "nestjs-i18n";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareService } from "src/share/share.service";
import { ConfigService } from "src/config/config.service";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import { User } from "@prisma/client";
import { AccessPolicyService } from "src/accessPolicy/accessPolicy.service";

@Injectable()
export class ShareSecurityGuard extends JwtGuard {
  constructor(
    private shareService: ShareService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly i18n: I18nService,
    private accessPolicyService: AccessPolicyService,
  ) {
    super(configService);
  }

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const shareId = Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id;

    const shareToken = request.cookies[`share_${shareId}_token`];

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { accessPolicy: true, security: true, reverseShare: true },
    });

    if (!share) throw new NotFoundException(this.i18n.t("share.notFound"));

    // Run the JWTGuard to set the user
    await super.canActivate(context);
    const user = request.user as User;

    // If admin access is enabled and user is admin, allow access
    if (
      user?.isAdmin &&
      this.configService.get("share.allowAdminAccessAllShares")
    ) {
      return true;
    }

    if (
      moment().isAfter(share.expiration) &&
      !moment(share.expiration).isSame(0)
    ) {
      throw new NotFoundException(this.i18n.t("share.notFound"));
    }

    this.accessPolicyService.assertAllowed(share.accessPolicy, {
      userId: user?.id,
    });

    const passwordHash =
      share.accessPolicy?.passwordHash ?? share.security?.password;
    const policyMaxViews = share.accessPolicy?.maxViews;
    const hasViewLimit =
      Boolean(share.accessPolicy?.oneTime) ||
      (policyMaxViews !== null && policyMaxViews !== undefined) ||
      Boolean(share.security?.maxViews);

    if (share.pickupCode && !shareToken)
      throw new ForbiddenException(
        "Pickup code required",
        "pickup_code_required",
      );

    if (passwordHash && !shareToken)
      throw new ForbiddenException(
        this.i18n.t("file.passwordProtected"),
        "share_password_required",
      );

    if (!(await this.shareService.verifyShareToken(share, shareToken))) {
      if (!shareToken && !share.pickupCode && !passwordHash && !hasViewLimit) {
        const token = await this.shareService.getShareToken(
          share.id,
          undefined,
        );
        response.cookie(`share_${share.id}_token`, token, {
          path: "/",
          httpOnly: true,
        });
        return true;
      }

      throw new ForbiddenException(
        this.i18n.t("share.tokenRequired"),
        "share_token_required",
      );
    }

    // Only the creator and reverse share creator can access the reverse share if it's not public
    if (
      share.reverseShare &&
      !share.reverseShare.publicAccess &&
      share.creatorId !== user?.id &&
      share.reverseShare.creatorId !== user?.id
    )
      throw new ForbiddenException(
        this.i18n.t("share.privateShare"),
        "private_share",
      );

    return true;
  }
}
