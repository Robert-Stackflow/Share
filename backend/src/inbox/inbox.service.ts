import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  AssetSource,
  AssetType,
  Asset,
  InboxSubmissionStatus,
  User,
} from "@prisma/client";
import * as crypto from "crypto";
import { I18nService } from "nestjs-i18n";
import { AccessPolicyService } from "src/accessPolicy/accessPolicy.service";
import { ActivityService } from "src/activity/activity.service";
import { AssetService } from "src/asset/asset.service";
import { CreateAssetDTO, CreateAssetType } from "src/asset/dto/createAsset.dto";
import { ConfigService } from "src/config/config.service";
import { StorageService } from "src/storage/storage.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateReverseShareDTO } from "src/reverseShare/dto/createReverseShare.dto";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { roomChanges } from "src/room/room.events";

type CreateInboxSubmissionInput = {
  message?: string;
  assets?: CreateAssetDTO[];
  hasFiles?: boolean;
  fileCount?: number;
};

type AcceptInboxSubmissionInput = {
  createShare?: boolean;
  roomId?: string;
};

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  constructor(
    private reverseShareService: ReverseShareService,
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly i18n: I18nService,
    private assetService: AssetService,
    private activityService?: ActivityService,
    private accessPolicyService?: AccessPolicyService,
    private storageService?: StorageService,
  ) {}

  private recordActivity(input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown> | null;
  }) {
    void this.activityService?.record(input).catch(() => undefined);
  }

  async create(data: CreateReverseShareDTO, creatorId: string) {
    const token = await this.reverseShareService.create(data, creatorId);
    const appUrl = this.config.get("general.appUrl");

    if (data.accessControl) {
      const reverseShare = await this.prisma.reverseShare.findFirst({
        where: { token },
      });
      if (reverseShare) {
        await this.accessPolicyService?.upsertForRelation(
          { reverseShareId: reverseShare.id },
          data.accessControl,
        );
      }
    }

    this.recordActivity({
      actorId: creatorId,
      action: "inbox.create",
      targetType: "inbox",
      targetId: token,
    });

    return {
      token,
      link: `${appUrl}/inbox/${token}`,
      legacyLink: `${appUrl}/upload/${token}`,
    };
  }

  async listByOwner(ownerId: string) {
    return this.reverseShareService.getAllByUser(ownerId);
  }

  async getByToken(token: string) {
    const isValid = await this.reverseShareService.isValid(token);
    if (!isValid) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    return this.reverseShareService.getByToken(token);
  }

  async removeOwned(id: string, ownerId: string) {
    const inbox = await this.prisma.reverseShare.findFirst({
      where: { id, creatorId: ownerId },
    });

    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    await this.reverseShareService.remove(id);
  }

  async createSubmission(token: string, data: CreateInboxSubmissionInput) {
    const inbox = await this.getValidInboxByToken(token);
    const assets = data.assets ?? [];
    const modernClient = data.fileCount !== undefined;
    const expectedFileCount = modernClient
      ? data.fileCount
      : data.hasFiles
        ? -1
        : 0;

    if (
      !Number.isInteger(expectedFileCount) ||
      expectedFileCount > inbox.maxFileCount ||
      expectedFileCount < (modernClient ? 0 : -1)
    ) {
      throw new BadRequestException("Invalid inbox file count");
    }

    if (assets.length === 0 && expectedFileCount === 0) {
      throw new BadRequestException(
        "Inbox submission requires at least one asset",
      );
    }

    const submission = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.reverseShare.updateMany({
        where: {
          id: inbox.id,
          remainingUses: { gt: 0 },
          shareExpiration: { gt: new Date() },
        },
        data: { remainingUses: { decrement: 1 } },
      });
      if (claimed.count !== 1) {
        throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
      }

      return transaction.inboxSubmission.create({
        data: {
          message: data.message,
          status: modernClient
            ? InboxSubmissionStatus.UPLOADING
            : InboxSubmissionStatus.PENDING,
          expectedFileCount,
          reverseShare: { connect: { id: inbox.id } },
        },
        include: { assets: true },
      });
    });

    const createdAssets = [];
    try {
      for (const asset of assets) {
        createdAssets.push(
          await this.createSubmissionAsset(submission.id, asset),
        );
      }
    } catch (error) {
      if (modernClient) {
        await this.cancelSubmission(token, submission.id).catch(
          (cleanupError) =>
            this.logger.error(
              "Could not cancel failed inbox submission",
              cleanupError,
            ),
        );
      }
      throw error;
    }

    this.recordActivity({
      actorId: null,
      action: "inbox.submission",
      targetType: "inboxSubmission",
      targetId: submission.id,
      metadata: { inboxId: inbox.id, assetCount: createdAssets.length },
    });

    return { ...submission, assets: createdAssets };
  }

  async addSubmissionFile(
    token: string,
    submissionId: string,
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
  ) {
    // The quota is claimed when a submission starts. Its file chunks must still
    // be accepted when that claim uses the inbox's final available submission.
    const inbox = await this.reverseShareService.getByToken(token);
    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }
    const submission = await this.prisma.inboxSubmission.findFirst({
      where: {
        id: submissionId,
        reverseShareId: inbox.id,
        OR: [
          { status: InboxSubmissionStatus.UPLOADING },
          { status: InboxSubmissionStatus.PENDING, expectedFileCount: -1 },
        ],
      },
    });

    if (!submission) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    if (
      !Number.isInteger(chunk.index) ||
      !Number.isInteger(chunk.total) ||
      chunk.index < 0 ||
      chunk.total < 1 ||
      chunk.index >= chunk.total ||
      !file.name
    ) {
      throw new BadRequestException("Invalid inbox file chunk");
    }

    const modernUpload = submission.status === InboxSubmissionStatus.UPLOADING;
    if (modernUpload && chunk.index > 0) {
      const tracked = file.id
        ? await this.prisma.asset.findFirst({
            where: {
              id: file.id,
              inboxSubmissionId: submission.id,
              type: AssetType.FILE,
              size: null,
            },
          })
        : null;
      if (!tracked) {
        throw new BadRequestException("Unknown inbox upload file");
      }
    }

    const chunkSize = Buffer.isBuffer(data)
      ? data.length
      : Buffer.from(data, "base64").length;
    if (BigInt(chunkSize) > BigInt(inbox.maxShareSize)) {
      throw new BadRequestException("Inbox file exceeds the size limit");
    }

    const finishedFiles = await this.prisma.asset.findMany({
      where: {
        inboxSubmissionId: submission.id,
        type: AssetType.FILE,
        size: { not: null },
      },
      select: { size: true },
    });
    const finishedSize = finishedFiles.reduce(
      (sum, asset) => sum + BigInt(asset.size!),
      0n,
    );
    const projectedFileSize =
      BigInt(chunk.index) * BigInt(this.config.get("share.chunkSize")) +
      BigInt(chunkSize);
    if (finishedSize + projectedFileSize > BigInt(inbox.maxShareSize)) {
      throw new BadRequestException("Inbox file exceeds the size limit");
    }

    const created = await this.assetService.createFile(
      data,
      chunk,
      file,
      undefined,
      {
        id: submission.id,
        kind: "INBOX_SUBMISSION",
      },
      modernUpload,
    );

    const stored = await this.prisma.asset.findMany({
      where: { inboxSubmissionId: submission.id, type: AssetType.FILE },
      select: { id: true, size: true, type: true, storage: true },
    });
    const totalSize = stored.reduce(
      (sum, asset) => sum + BigInt(asset.size ?? 0),
      0n,
    );
    const stillUploading =
      !modernUpload ||
      (await this.prisma.inboxSubmission.findFirst({
        where: { id: submission.id, status: InboxSubmissionStatus.UPLOADING },
      }));
    if (
      !stillUploading ||
      stored.length > inbox.maxFileCount ||
      (modernUpload && stored.length > submission.expectedFileCount) ||
      totalSize > BigInt(inbox.maxShareSize)
    ) {
      if (modernUpload || chunk.index === chunk.total - 1) {
        await this.assetService.remove(created as Asset);
      }
      throw new BadRequestException(
        "Inbox file limit exceeded or submission closed",
      );
    }

    await this.prisma.inboxSubmission.update({
      where: { id: submission.id },
      data: { updatedAt: new Date() },
    });

    return created;
  }

  async completeSubmission(token: string, submissionId: string) {
    const inbox = await this.reverseShareService.getByToken(token);
    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }
    const submission = await this.prisma.inboxSubmission.findFirst({
      where: {
        id: submissionId,
        reverseShareId: inbox.id,
        status: {
          in: [InboxSubmissionStatus.UPLOADING, InboxSubmissionStatus.PENDING],
        },
        expectedFileCount: { gte: 0 },
      },
      include: { assets: true },
    });
    if (!submission) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }
    if (submission.status === InboxSubmissionStatus.PENDING) return submission;
    const files = submission.assets.filter(
      (asset) => asset.type === AssetType.FILE,
    );
    const totalSize = files.reduce(
      (sum, asset) => sum + BigInt(asset.size ?? 0),
      0n,
    );
    if (
      submission.assets.length === 0 ||
      files.length !== submission.expectedFileCount ||
      files.some((asset) => asset.size === null) ||
      files.length > inbox.maxFileCount ||
      totalSize > BigInt(inbox.maxShareSize)
    ) {
      throw new BadRequestException(
        "Inbox submission is incomplete or exceeds its limits",
      );
    }
    const changed = await this.prisma.inboxSubmission.updateMany({
      where: { id: submission.id, status: InboxSubmissionStatus.UPLOADING },
      data: { status: InboxSubmissionStatus.PENDING },
    });
    if (changed.count !== 1) {
      throw new BadRequestException("Inbox submission is no longer uploading");
    }
    return this.prisma.inboxSubmission.findFirst({
      where: { id: submission.id },
      include: { assets: true },
    });
  }

  async cancelSubmission(token: string, submissionId: string) {
    const inbox = await this.reverseShareService.getByToken(token);
    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }
    const submission = await this.prisma.inboxSubmission.findFirst({
      where: { id: submissionId, reverseShareId: inbox.id },
      include: { assets: true },
    });
    if (
      !submission ||
      (submission.status !== InboxSubmissionStatus.UPLOADING &&
        submission.status !== InboxSubmissionStatus.CANCELLED)
    ) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }
    if (submission.status === InboxSubmissionStatus.UPLOADING) {
      await this.prisma.$transaction(async (transaction) => {
        const changed = await transaction.inboxSubmission.updateMany({
          where: { id: submission.id, status: InboxSubmissionStatus.UPLOADING },
          data: { status: InboxSubmissionStatus.CANCELLED },
        });
        if (changed.count === 1) {
          await transaction.reverseShare.update({
            where: { id: inbox.id },
            data: { remainingUses: { increment: 1 } },
          });
        }
      });
    }
    for (const asset of submission.assets) {
      await this.assetService.remove(asset);
    }
    return { cancelled: true };
  }

  @Cron("*/10 * * * *")
  async cancelStaleSubmissions() {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await this.prisma.inboxSubmission.findMany({
      where: {
        status: InboxSubmissionStatus.UPLOADING,
        updatedAt: { lt: cutoff },
      },
      select: { id: true, reverseShare: { select: { token: true } } },
    });
    for (const submission of stale) {
      await this.cancelSubmission(
        submission.reverseShare.token,
        submission.id,
      ).catch((error) =>
        this.logger.error(
          `Could not cancel stale submission ${submission.id}`,
          error,
        ),
      );
    }
  }

  async listSubmissions(inboxId: string, ownerId: string) {
    const inbox = await this.prisma.reverseShare.findFirst({
      where: { id: inboxId, creatorId: ownerId },
      include: {
        submissions: {
          where: {
            status: {
              in: [
                InboxSubmissionStatus.PENDING,
                InboxSubmissionStatus.ACCEPTED,
                InboxSubmissionStatus.REJECTED,
              ],
            },
          },
          include: { assets: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    return inbox.submissions;
  }

  async acceptSubmission(
    id: string,
    owner: Pick<User, "id">,
    options: AcceptInboxSubmissionInput = {},
  ) {
    const submission = await this.getOwnedPendingSubmission(id, owner.id);
    if (options.createShare && options.roomId) {
      throw new BadRequestException("Choose a share or a room");
    }
    const room = options.roomId
      ? await this.prisma.room.findFirst({
          where: { roomId: options.roomId, ownerId: owner.id },
        })
      : null;
    if (options.roomId && !room) {
      throw new NotFoundException("Room not found");
    }
    let share = undefined;

    if (options.createShare) {
      const fileAssetCount = submission.assets.filter(
        (asset) => asset.type === AssetType.FILE,
      ).length;

      share = await this.prisma.share.create({
        data: {
          id: crypto.randomUUID(),
          uploadLocked: true,
          isZipReady: fileAssetCount <= 1,
          expiration: submission.reverseShare.shareExpiration,
          creator: { connect: { id: owner.id } },
          reverseShare: { connect: { id: submission.reverseShareId } },
          storageProvider:
            this.storageService?.getConfiguredProvider() ??
            (this.config.get("s3.enabled") ? "S3" : "LOCAL"),
        },
      });
    }

    await this.prisma.asset.updateMany({
      where: { inboxSubmissionId: id },
      data: {
        ownerId: owner.id,
        inboxSubmissionId: null,
        ...(share
          ? { shareId: share.id, source: AssetSource.SHARE }
          : room
            ? { shareId: null, roomId: room.id, source: AssetSource.ROOM }
            : { shareId: null, source: AssetSource.INBOX }),
      },
    });

    const accepted = await this.prisma.inboxSubmission.update({
      where: { id },
      data: { status: InboxSubmissionStatus.ACCEPTED },
      include: { assets: true },
    });

    this.recordActivity({
      actorId: owner.id,
      action: "inbox.accept",
      targetType: "inboxSubmission",
      targetId: id,
      metadata: { createdShare: Boolean(share), roomId: room?.roomId },
    });

    if (room) roomChanges.next(room.roomId);

    return share ? { ...accepted, share } : accepted;
  }

  async rejectSubmission(id: string, owner: Pick<User, "id">) {
    const submission = await this.getOwnedPendingSubmission(id, owner.id);

    for (const asset of submission.assets) {
      await this.assetService.remove(asset);
    }

    const rejected = await this.prisma.inboxSubmission.update({
      where: { id },
      data: { status: InboxSubmissionStatus.REJECTED },
      include: { assets: true },
    });

    this.recordActivity({
      actorId: owner.id,
      action: "inbox.reject",
      targetType: "inboxSubmission",
      targetId: id,
    });

    return rejected;
  }

  private async getValidInboxByToken(token: string) {
    const isValid = await this.reverseShareService.isValid(token);
    if (!isValid) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    const inbox = await this.reverseShareService.getByToken(token);
    if (!inbox) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    return inbox;
  }

  private async createSubmissionAsset(
    submissionId: string,
    asset: CreateAssetDTO,
  ) {
    const container = { id: submissionId, kind: "INBOX_SUBMISSION" as const };

    if (asset.type === CreateAssetType.TEXT) {
      return this.assetService.createText(
        { content: asset.content },
        undefined,
        container,
      );
    }

    if (asset.type === CreateAssetType.LINK) {
      return this.assetService.createLink(
        { url: asset.url },
        undefined,
        container,
      );
    }

    throw new BadRequestException(
      "Inbox file assets must be uploaded through a file upload route",
    );
  }

  private async getOwnedPendingSubmission(id: string, ownerId: string) {
    const submission = await this.prisma.inboxSubmission.findFirst({
      where: { id, reverseShare: { creatorId: ownerId } },
      include: { assets: true, reverseShare: true },
    });

    if (!submission) {
      throw new NotFoundException(this.i18n.t("reverseShare.notFound"));
    }

    if (submission.status !== InboxSubmissionStatus.PENDING) {
      throw new BadRequestException("Inbox submission is not pending");
    }

    return submission;
  }
}
