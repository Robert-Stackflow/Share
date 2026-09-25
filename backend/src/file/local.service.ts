import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as mime from "mime-types";
import { I18nService } from "nestjs-i18n";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { validate as isValidUUID } from "uuid";
import { ASSET_DIRECTORY, SHARE_DIRECTORY } from "../constants";
import { Readable } from "stream";
import { AssetType, StorageProvider } from "@prisma/client";

@Injectable()
export class LocalFileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name: string },
    shareId: string,
  ) {
    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException(this.i18n.t("file.invalidIdFormat"));
    }

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        assets: { where: { type: AssetType.FILE } },
        reverseShare: true,
      },
    });

    if (share.uploadLocked)
      throw new BadRequestException(this.i18n.t("file.alreadyCompleted"));

    let diskFileSize: number;
    try {
      diskFileSize = (
        await fs.stat(`${ASSET_DIRECTORY}/${file.id}.tmp-chunk`)
      ).size;
    } catch {
      diskFileSize = 0;
    }

    // If the sent chunk index and the expected chunk index doesn't match throw an error
    const chunkSize = this.config.get("share.chunkSize");
    const expectedChunkIndex = Math.ceil(diskFileSize / chunkSize);

    if (expectedChunkIndex != chunk.index)
      throw new BadRequestException({
        message: this.i18n.t("file.unexpectedChunk"),
        error: "unexpected_chunk_index",
        expectedChunkIndex,
      });

    const buffer = Buffer.from(data, "base64");

    // Check if there is enough space on the server
    const space = await fs.statfs(SHARE_DIRECTORY);
    const availableSpace = space.bavail * space.bsize;
    if (availableSpace < buffer.byteLength) {
      throw new InternalServerErrorException(
        this.i18n.t("file.notEnoughSpace"),
      );
    }

    // Check if share size limit is exceeded
    const fileSizeSum = share.assets.reduce(
      (n, { size }) => n + parseInt(size),
      0,
    );

    const shareSizeSum = fileSizeSum + diskFileSize + buffer.byteLength;

    if (
      shareSizeSum > this.config.get("share.maxSize") ||
      (share.reverseShare?.maxShareSize &&
        shareSizeSum > parseInt(share.reverseShare.maxShareSize))
    ) {
      throw new HttpException(
        this.i18n.t("file.maxSizeExceeded"),
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await fs.appendFile(
      `${ASSET_DIRECTORY}/${file.id}.tmp-chunk`,
      buffer,
    );

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      await fs.rename(
        `${ASSET_DIRECTORY}/${file.id}.tmp-chunk`,
        `${ASSET_DIRECTORY}/${file.id}`,
      );
      const fileSize = (await fs.stat(`${ASSET_DIRECTORY}/${file.id}`)).size;
      await this.prisma.asset.create({
        data: {
          id: file.id,
          type: AssetType.FILE,
          name: file.name,
          size: fileSize.toString(),
          mimeType:
            mime.lookup(file.name) || "application/octet-stream",
          storage: StorageProvider.LOCAL,
          share: { connect: { id: shareId } },
          ...(share.creatorId
            ? { owner: { connect: { id: share.creatorId } } }
            : {}),
        },
      });
    }

    return file;
  }

  async get(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.asset.findFirst({
      where: { id: fileId, shareId, type: AssetType.FILE },
    });

    if (!fileMetaData)
      throw new NotFoundException(this.i18n.t("file.notFound"));

    const file = createReadStream(`${ASSET_DIRECTORY}/${fileMetaData.storageKey ?? fileId}`);

    return {
      metaData: {
        mimeType: fileMetaData.mimeType || mime.lookup(fileMetaData.name),
        ...fileMetaData,
        size: fileMetaData.size,
      },
      file,
    };
  }

  async remove(shareId: string, fileId: string) {
    const fileMetaData = await this.prisma.asset.findFirst({
      where: { id: fileId, shareId, type: AssetType.FILE },
    });

    if (!fileMetaData)
      throw new NotFoundException(this.i18n.t("file.notFound"));

    await this.prisma.asset.delete({ where: { id: fileId } });
    const storageKey = fileMetaData.storageKey ?? fileId;
    const references = await this.prisma.asset.count({
      where: {
        type: AssetType.FILE,
        OR: [{ id: storageKey }, { storageKey }],
      },
    });
    if (references === 0) {
      await fs.rm(`${ASSET_DIRECTORY}/${storageKey}`, { force: true });
      await fs.rm(`${ASSET_DIRECTORY}/${storageKey}.tmp-chunk`, { force: true });
    }
  }

  async deleteAllFiles(shareId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { shareId, type: AssetType.FILE },
      select: { id: true },
    });

    for (const asset of assets) {
      await this.remove(shareId, asset.id);
    }

    await fs.rm(`${SHARE_DIRECTORY}/${shareId}`, {
      recursive: true,
      force: true,
    });
  }

  async getZip(shareId: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const zipStream = createReadStream(
        `${SHARE_DIRECTORY}/${shareId}/archive.zip`,
      );

      zipStream.on("error", (err) => {
        reject(new InternalServerErrorException(err));
      });

      zipStream.on("open", () => {
        resolve(zipStream);
      });
    });
  }
}
