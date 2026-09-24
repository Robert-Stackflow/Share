import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InboxSubmissionStatus } from "@prisma/client";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { InboxService } from "./inbox.service";
import { roomChanges } from "../room/room.events";

const createInbox = {
  shareExpiration: "7-days",
  maxShareSize: "1000",
  maxUseCount: 3,
  sendEmailNotification: false,
  simplified: false,
  publicAccess: true,
};

function createServiceMock(
  remainingUses = 3,
  maxShareSize = "1000",
  maxFileCount = 10,
) {
  const calls: any[] = [];
  const fileChunkSizes: Record<string, number> = {};
  const reverseShares = [
    {
      id: "inbox-1",
      token: "token-1",
      creatorId: "user-1",
      shareExpiration: new Date(Date.now() + 60_000),
      remainingUses,
      maxShareSize,
      maxFileCount,
      sendEmailNotification: false,
      simplified: false,
      publicAccess: true,
    },
  ];
  const submissions: any[] = [
    {
      id: "submission-1",
      reverseShareId: "inbox-1",
      status: InboxSubmissionStatus.PENDING,
      expectedFileCount: -1,
      message: "Please review",
      assets: [
        {
          id: "asset-text-1",
          type: "TEXT",
          content: "hello",
          inboxSubmissionId: "submission-1",
        },
        {
          id: "asset-link-1",
          type: "LINK",
          url: "https://example.com",
          inboxSubmissionId: "submission-1",
        },
      ],
    },
    {
      id: "accepted-submission",
      reverseShareId: "inbox-1",
      status: InboxSubmissionStatus.ACCEPTED,
      message: null,
      assets: [],
    },
  ];

  const cloneSubmission = (submission: any) => ({
    ...submission,
    assets: submission.assets.map((asset: any) => ({ ...asset })),
    reverseShare: reverseShares.find(
      (inbox) => inbox.id === submission.reverseShareId,
    ),
  });

  return {
    calls,
    reverseShareService: {
      create: async (data: any, userId: string) => {
        calls.push(["reverseShare.create", data, userId]);
        return "token-1";
      },
      getAllByUser: async (userId: string) => {
        calls.push(["reverseShare.getAllByUser", userId]);
        return [{ id: "inbox-1", token: "token-1", creatorId: userId }];
      },
      isValid: async (token: string) => {
        calls.push(["reverseShare.isValid", token]);
        const inbox = reverseShares.find((item) => item.token === token);
        return Boolean(
          inbox &&
            inbox.remainingUses > 0 &&
            inbox.shareExpiration > new Date(),
        );
      },
      getByToken: async (token: string) => {
        calls.push(["reverseShare.getByToken", token]);
        return reverseShares.find((inbox) => inbox.token === token) ?? null;
      },
      remove: async (id: string) => {
        calls.push(["reverseShare.remove", id]);
      },
    },
    prisma: {
      async $transaction(action: (transaction: any) => Promise<any>) {
        calls.push(["prisma.$transaction"]);
        return action(this);
      },
      reverseShare: {
        findFirst: async (args: any) => {
          calls.push(["reverseShare.findFirst", args]);
          if (args.where.token) {
            return (
              reverseShares.find((item) => item.token === args.where.token) ??
              null
            );
          }
          const inbox = reverseShares.find(
            (item) =>
              item.id === args.where.id &&
              item.creatorId === args.where.creatorId,
          );
          if (inbox && args.include?.submissions) {
            const visible = args.include.submissions.where?.status?.in;
            return {
              ...inbox,
              submissions: submissions
                .filter(
                  (submission) =>
                    submission.reverseShareId === inbox.id &&
                    (!visible || visible.includes(submission.status)),
                )
                .map(cloneSubmission),
            };
          }
          if (
            args.where.id === "inbox-1" &&
            args.where.creatorId === "user-1"
          ) {
            return { id: "inbox-1", creatorId: "user-1" };
          }
          return null;
        },
        update: async (args: any) => {
          calls.push(["reverseShare.update", args]);
          const inbox = reverseShares.find(
            (item) =>
              item.id === args.where.id || item.token === args.where.token,
          );
          if (inbox && args.data.remainingUses?.decrement) {
            inbox.remainingUses -= args.data.remainingUses.decrement;
          }
          if (inbox && args.data.remainingUses?.increment) {
            inbox.remainingUses += args.data.remainingUses.increment;
          }
          return inbox;
        },
        updateMany: async (args: any) => {
          calls.push(["reverseShare.updateMany", args]);
          const inbox = reverseShares.find((item) => item.id === args.where.id);
          if (
            !inbox ||
            inbox.remainingUses <= args.where.remainingUses.gt ||
            inbox.shareExpiration <= args.where.shareExpiration.gt
          ) {
            return { count: 0 };
          }
          inbox.remainingUses -= args.data.remainingUses.decrement;
          return { count: 1 };
        },
      },
      inboxSubmission: {
        findMany: async (args: any) => {
          calls.push(["inboxSubmission.findMany", args]);
          return submissions
            .filter(
              (item) =>
                item.status === args.where.status &&
                item.updatedAt < args.where.updatedAt.lt,
            )
            .map((item) => ({
              id: item.id,
              reverseShare: reverseShares.find(
                (inbox) => inbox.id === item.reverseShareId,
              ),
            }));
        },
        create: async (args: any) => {
          calls.push(["inboxSubmission.create", args]);
          const submission = {
            id: `submission-${submissions.length + 1}`,
            reverseShareId: args.data.reverseShare.connect.id,
            status: InboxSubmissionStatus.PENDING,
            expectedFileCount: args.data.expectedFileCount ?? 0,
            message: args.data.message ?? null,
            assets: [],
          };
          submission.status = args.data.status ?? InboxSubmissionStatus.PENDING;
          submissions.push(submission);
          return cloneSubmission(submission);
        },
        findFirst: async (args: any) => {
          calls.push(["inboxSubmission.findFirst", args]);
          const submission = submissions.find((item) => {
            if (item.id !== args.where.id) return false;
            if (typeof args.where.status === "string" && item.status !== args.where.status)
              return false;
            if (args.where.status?.in && !args.where.status.in.includes(item.status))
              return false;
            if (
              args.where.expectedFileCount?.gte !== undefined &&
              item.expectedFileCount < args.where.expectedFileCount.gte
            ) return false;
            if (args.where.reverseShareId) {
              return (
                item.reverseShareId === args.where.reverseShareId &&
                (!args.where.OR ||
                  args.where.OR.some(
                    (clause: any) =>
                      clause.status === item.status &&
                      (clause.expectedFileCount === undefined ||
                        clause.expectedFileCount === item.expectedFileCount),
                  ))
              );
            }
            if (!args.where.reverseShare) return true;
            const inbox = reverseShares.find(
              (reverseShare) => reverseShare.id === item.reverseShareId,
            );
            return inbox?.creatorId === args.where.reverseShare.creatorId;
          });
          return submission ? cloneSubmission(submission) : null;
        },
        update: async (args: any) => {
          calls.push(["inboxSubmission.update", args]);
          const submission = submissions.find(
            (item) => item.id === args.where.id,
          );
          if (submission) {
            Object.assign(submission, args.data);
          }
          return cloneSubmission(submission);
        },
        updateMany: async (args: any) => {
          calls.push(["inboxSubmission.updateMany", args]);
          const submission = submissions.find(
            (item) =>
              item.id === args.where.id &&
              item.status === args.where.status,
          );
          if (!submission) return { count: 0 };
          Object.assign(submission, args.data);
          return { count: 1 };
        },
      },
      asset: {
        findFirst: async (args: any) => {
          calls.push(["asset.findFirst", args]);
          return submissions
            .flatMap((submission) => submission.assets)
            .find(
              (asset) =>
                asset.id === args.where.id &&
                asset.inboxSubmissionId === args.where.inboxSubmissionId &&
                asset.type === args.where.type &&
                asset.size === args.where.size,
            ) ?? null;
        },
        findMany: async (args: any) => {
          calls.push(["asset.findMany", args]);
          return submissions
            .filter(
              (submission) =>
                submission.id === args.where.inboxSubmissionId,
            )
            .flatMap((submission) => submission.assets)
            .filter(
              (asset) => !args.where.type || asset.type === args.where.type,
            )
            .filter(
              (asset) =>
                args.where.size?.not !== null || asset.size !== null,
            );
        },
        updateMany: async (args: any) => {
          calls.push(["asset.updateMany", args]);
          for (const submission of submissions) {
            for (const asset of submission.assets) {
              if (asset.inboxSubmissionId === args.where.inboxSubmissionId) {
                Object.assign(asset, args.data);
              }
            }
          }
          return { count: 2 };
        },
      },
      share: {
        create: async (args: any) => {
          calls.push(["share.create", args]);
          return {
            id: args.data.id,
            uploadLocked: args.data.uploadLocked,
            isZipReady: args.data.isZipReady,
            creatorId: args.data.creator.connect.id,
          };
        },
      },
      room: {
        findFirst: async (args: any) => {
          calls.push(["room.findFirst", args]);
          return args.where.roomId === "room-1" &&
            args.where.ownerId === "user-1"
            ? { id: "room-db-1", roomId: "room-1" }
            : null;
        },
      },
    },
    assetService: {
      createText: async (data: any, owner: any, container: any) => {
        calls.push(["asset.createText", data, owner, container]);
        const submission = submissions.find((item) => item.id === container.id);
        const asset = {
          id: `asset-text-${submission.assets.length + 1}`,
          type: "TEXT",
          content: data.content,
          inboxSubmissionId: container.id,
        };
        submission.assets.push(asset);
        return asset;
      },
      createLink: async (data: any, owner: any, container: any) => {
        calls.push(["asset.createLink", data, owner, container]);
        const submission = submissions.find((item) => item.id === container.id);
        const asset = {
          id: `asset-link-${submission.assets.length + 1}`,
          type: "LINK",
          url: data.url,
          inboxSubmissionId: container.id,
        };
        submission.assets.push(asset);
        return asset;
      },
      createFile: async (
        data: any,
        chunk: any,
        file: any,
        owner: any,
        container: any,
        trackIncomplete = false,
      ) => {
        calls.push([
          "asset.createFile",
          data,
          chunk,
          file,
          owner,
          container,
          trackIncomplete,
        ]);
        const submission = submissions.find((item) => item.id === container.id);
        const assetId = file.id ?? `asset-file-${submission.assets.length + 1}`;
        fileChunkSizes[assetId] =
          (fileChunkSizes[assetId] ?? 0) + Buffer.byteLength(data);
        let asset = submission.assets.find((item: any) => item.id === assetId);
        if (!asset) {
          asset = {
            id: assetId,
            type: "FILE",
            name: file.name,
            size: trackIncomplete && chunk.index !== chunk.total - 1
              ? null
              : String(fileChunkSizes[assetId]),
            inboxSubmissionId: container.id,
          };
          if (trackIncomplete || chunk.index === chunk.total - 1) {
            submission.assets.push(asset);
          }
        } else if (chunk.index === chunk.total - 1) {
          asset.size = String(fileChunkSizes[assetId]);
        }
        return asset;
      },
      remove: async (asset: any) => {
        calls.push(["asset.remove", asset]);
        for (const submission of submissions) {
          submission.assets = submission.assets.filter(
            (item: any) => item.id !== asset.id,
          );
        }
      },
    },
    config: {
      get: (key: string) => {
        calls.push(["config.get", key]);
        if (key === "general.appUrl") return "https://share.example";
        if (key === "s3.enabled") return false;
        if (key === "share.chunkSize") return 3;
        return undefined;
      },
    },
    i18n: {
      t: (key: string) => key,
    },
  };
}

function createInboxService(
  mocks: ReturnType<typeof createServiceMock>,
  accessPolicyService?: any,
) {
  return new (InboxService as any)(
    mocks.reverseShareService,
    mocks.prisma,
    mocks.config,
    mocks.i18n,
    mocks.assetService,
    undefined,
    accessPolicyService,
  ) as InboxService;
}

function createAccessPolicyMock() {
  const calls: any[] = [];
  return {
    calls,
    service: {
      upsertForRelation: async (relation: any, input: any) => {
        calls.push(["upsertForRelation", relation, input]);
        return { id: "policy-1", ...relation, ...input };
      },
    },
  };
}

test("create returns new inbox and legacy upload links", async () => {
  const { calls, config, i18n, prisma, reverseShareService } =
    createServiceMock();
  const service = createInboxService({
    calls,
    config,
    i18n,
    prisma,
    reverseShareService,
    assetService: undefined as any,
  } as any);

  const inbox = await service.create(createInbox as any, "user-1");

  assert.deepEqual(inbox, {
    token: "token-1",
    link: "https://share.example/inbox/token-1",
    legacyLink: "https://share.example/upload/token-1",
  });
  assert.deepEqual(calls.slice(0, 2), [
    ["reverseShare.create", createInbox, "user-1"],
    ["config.get", "general.appUrl"],
  ]);
});

test("create does not write an access policy without an accessControl payload", async () => {
  const mocks = createServiceMock();
  const { calls, service: accessPolicyService } = createAccessPolicyMock();
  const service = createInboxService(
    { ...mocks, assetService: undefined as any } as any,
    accessPolicyService,
  );

  await service.create(createInbox as any, "user-1");

  assert.equal(calls.length, 0);
});

test("create upserts an access policy for the reverse share when accessControl is sent", async () => {
  const mocks = createServiceMock();
  const { calls: policyCalls, service: accessPolicyService } =
    createAccessPolicyMock();
  const service = createInboxService(
    { ...mocks, assetService: undefined as any } as any,
    accessPolicyService,
  );

  await service.create(
    {
      ...createInbox,
      accessControl: { maxViews: 2, allowAnonymous: false },
    } as any,
    "user-1",
  );

  assert.equal(policyCalls.length, 1);
  assert.deepEqual(policyCalls[0], [
    "upsertForRelation",
    { reverseShareId: "inbox-1" },
    { maxViews: 2, allowAnonymous: false },
  ]);
});

test("listByOwner and getByToken delegate to reverse share compatibility data", async () => {
  const { calls, config, i18n, prisma, reverseShareService } =
    createServiceMock();
  const service = createInboxService({
    calls,
    config,
    i18n,
    prisma,
    reverseShareService,
    assetService: undefined as any,
  } as any);

  const inboxes = await service.listByOwner("user-1");
  const inbox = await service.getByToken("token-1");

  assert.equal(inboxes[0].id, "inbox-1");
  assert.equal(inbox.id, "inbox-1");
  assert.deepEqual(calls, [
    ["reverseShare.getAllByUser", "user-1"],
    ["reverseShare.isValid", "token-1"],
    ["reverseShare.getByToken", "token-1"],
  ]);
});

test("getByToken rejects invalid inbox tokens", async () => {
  const { config, i18n, prisma, reverseShareService } = createServiceMock();
  const service = createInboxService({
    calls: [],
    config,
    i18n,
    prisma,
    reverseShareService,
    assetService: undefined as any,
  } as any);

  await assert.rejects(() => service.getByToken("missing"), NotFoundException);
});

test("removeOwned only deletes inboxes owned by the current user", async () => {
  const { calls, config, i18n, prisma, reverseShareService } =
    createServiceMock();
  const service = createInboxService({
    calls,
    config,
    i18n,
    prisma,
    reverseShareService,
    assetService: undefined as any,
  } as any);

  await service.removeOwned("inbox-1", "user-1");
  await assert.rejects(
    () => service.removeOwned("foreign-inbox", "user-1"),
    NotFoundException,
  );

  assert.deepEqual(calls, [
    [
      "reverseShare.findFirst",
      { where: { id: "inbox-1", creatorId: "user-1" } },
    ],
    ["reverseShare.remove", "inbox-1"],
    [
      "reverseShare.findFirst",
      { where: { id: "foreign-inbox", creatorId: "user-1" } },
    ],
  ]);
});

test("createSubmission stores pending assets and decrements inbox uses", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const submission = await (service as any).createSubmission("token-1", {
    message: "New pitch",
    assets: [
      { type: "TEXT", content: "hello inbox" },
      { type: "LINK", url: "https://example.com" },
    ],
  });

  assert.equal(submission.status, InboxSubmissionStatus.PENDING);
  assert.equal(submission.message, "New pitch");
  assert.deepEqual(
    submission.assets.map((asset: any) => asset.type),
    ["TEXT", "LINK"],
  );
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "reverseShare.updateMany" &&
        call[1].where.id === "inbox-1" &&
        call[1].data.remainingUses.decrement === 1,
    ),
  );
  assert.deepEqual(
    mocks.calls
      .filter((call) => call[0].startsWith("asset."))
      .map((call) => [call[0], call[3]]),
    [
      ["asset.createText", { id: "submission-3", kind: "INBOX_SUBMISSION" }],
      ["asset.createLink", { id: "submission-3", kind: "INBOX_SUBMISSION" }],
    ],
  );
});

test("createSubmission allows file-backed submissions before chunks are uploaded", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const submission = await (service as any).createSubmission("token-1", {
    message: "Files attached",
    hasFiles: true,
    assets: [],
  });

  assert.equal(submission.status, InboxSubmissionStatus.PENDING);
  assert.equal(submission.assets.length, 0);
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "reverseShare.updateMany" &&
        call[1].data.remainingUses.decrement === 1,
    ),
  );
});

test("addSubmissionFile verifies the inbox token and stores file chunks on the pending submission", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const file = await (service as any).addSubmissionFile(
    "token-1",
    "submission-1",
    "chunk-data",
    { index: 0, total: 1 },
    { id: "asset-file-1", name: "proposal.pdf" },
  );

  assert.equal(file.id, "asset-file-1");
  assert.deepEqual(
    mocks.calls.find((call) => call[0] === "asset.createFile"),
    [
      "asset.createFile",
      "chunk-data",
      { index: 0, total: 1 },
      { id: "asset-file-1", name: "proposal.pdf" },
      undefined,
      { id: "submission-1", kind: "INBOX_SUBMISSION" },
      false,
    ],
  );
});

test("one-time inbox accepts file chunks for its claimed submission, but no new submission", async () => {
  const mocks = createServiceMock(1);
  const service = createInboxService(mocks);

  const submission = await service.createSubmission("token-1", {
    hasFiles: true,
  });
  assert.equal(submission.status, InboxSubmissionStatus.PENDING);

  const file = await service.addSubmissionFile(
    "token-1",
    submission.id,
    "chunk-data",
    { index: 0, total: 1 },
    { name: "proposal.pdf" },
  );
  assert.equal(file.name, "proposal.pdf");
  await assert.rejects(
    () => service.createSubmission("token-1", { hasFiles: true }),
    NotFoundException,
  );
  await assert.rejects(
    () =>
      service.addSubmissionFile(
        "wrong-token",
        submission.id,
        "chunk-data",
        { index: 0, total: 1 },
        { name: "proposal.pdf" },
      ),
    NotFoundException,
  );
});

test("modern inbox submission stays out of review until every file is uploaded and completed", async () => {
  const mocks = createServiceMock(1, "1000", 1);
  const service = createInboxService(mocks);
  const submission = await service.createSubmission("token-1", {
    fileCount: 1,
  });

  assert.equal(submission.status, InboxSubmissionStatus.UPLOADING);
  assert.equal((await service.listSubmissions("inbox-1", "user-1")).length, 2);
  await assert.rejects(
    () => service.completeSubmission("token-1", submission.id),
    BadRequestException,
  );

  await service.addSubmissionFile(
    "token-1",
    submission.id,
    "file-data",
    { index: 0, total: 1 },
    { name: "proposal.txt" },
  );
  const completed = await service.completeSubmission("token-1", submission.id);
  assert.equal(completed.status, InboxSubmissionStatus.PENDING);
  assert.equal((await service.listSubmissions("inbox-1", "user-1")).length, 3);
  await assert.rejects(
    () =>
      service.addSubmissionFile(
        "token-1",
        submission.id,
        "extra",
        { index: 0, total: 1 },
        { name: "extra.txt" },
      ),
    NotFoundException,
  );
});

test("canceling an unfinished submission restores its one-time use", async () => {
  const mocks = createServiceMock(1);
  const service = createInboxService(mocks);
  const submission = await service.createSubmission("token-1", {
    fileCount: 1,
  });

  await service.cancelSubmission("token-1", submission.id);
  await service.cancelSubmission("token-1", submission.id);
  const replacement = await service.createSubmission("token-1", {
    fileCount: 1,
  });
  assert.equal(replacement.status, InboxSubmissionStatus.UPLOADING);
  assert.equal(
    mocks.calls.filter(
      (call) =>
        call[0] === "reverseShare.update" &&
        call[1].data.remainingUses?.increment === 1,
    ).length,
    1,
  );
});

test("inbox file count and stored file size limits are enforced by the service", async () => {
  const mocks = createServiceMock(2, "4", 1);
  const service = createInboxService(mocks);
  await assert.rejects(
    () => service.createSubmission("token-1", { fileCount: 2 }),
    BadRequestException,
  );
  const submission = await service.createSubmission("token-1", {
    fileCount: 1,
  });
  await assert.rejects(
    () =>
      service.addSubmissionFile(
        "token-1",
        submission.id,
        "too-large",
        { index: 0, total: 1 },
        { name: "large.txt" },
      ),
    BadRequestException,
  );
  const firstChunk = await service.addSubmissionFile(
    "token-1",
    submission.id,
    "abc",
    { index: 0, total: 2 },
    { name: "large.txt" },
  );
  await assert.rejects(
    () =>
      service.addSubmissionFile(
        "token-1",
        submission.id,
        "def",
        { index: 1, total: 2 },
        { id: firstChunk.id, name: "large.txt" },
      ),
    BadRequestException,
  );
  assert.equal(
    mocks.calls.filter((call) => call[0] === "asset.createFile").length,
    1,
  );
  await service.cancelSubmission("token-1", submission.id);
  assert.ok(mocks.calls.some((call) => call[0] === "asset.remove"));
});

test("listSubmissions only returns submissions for an inbox owned by the user", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const submissions = await (service as any).listSubmissions(
    "inbox-1",
    "user-1",
  );
  await assert.rejects(
    () => (service as any).listSubmissions("inbox-1", "user-2"),
    NotFoundException,
  );

  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].assets.length, 2);
  assert.deepEqual(mocks.calls[0], [
    "reverseShare.findFirst",
    {
      where: { id: "inbox-1", creatorId: "user-1" },
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
    },
  ]);
});

test("acceptSubmission moves pending assets into the owner asset library", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const accepted = await (service as any).acceptSubmission(
    "submission-1",
    { id: "user-1" },
    { createShare: false },
  );

  assert.equal(accepted.status, InboxSubmissionStatus.ACCEPTED);
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "asset.updateMany" &&
        call[1].where.inboxSubmissionId === "submission-1" &&
        call[1].data.ownerId === "user-1" &&
        call[1].data.inboxSubmissionId === null,
    ),
  );
});

test("acceptSubmission can publish pending assets as a completed share", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const accepted = await (service as any).acceptSubmission(
    "submission-1",
    { id: "user-1" },
    { createShare: true },
  );

  assert.equal(accepted.status, InboxSubmissionStatus.ACCEPTED);
  assert.equal(accepted.share.uploadLocked, true);
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "asset.updateMany" &&
        call[1].data.shareId === accepted.share.id &&
        call[1].data.ownerId === "user-1",
    ),
  );
});

test("acceptSubmission moves pending assets directly into an owned room", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);
  const changedRooms: string[] = [];
  const subscription = roomChanges.subscribe((id) => changedRooms.push(id));

  const accepted = await service.acceptSubmission(
    "submission-1",
    { id: "user-1" },
    {
      roomId: "room-1",
    },
  );
  subscription.unsubscribe();

  assert.equal(accepted.status, InboxSubmissionStatus.ACCEPTED);
  assert.deepEqual(changedRooms, ["room-1"]);
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "asset.updateMany" &&
        call[1].data.roomId === "room-db-1" &&
        call[1].data.source === "ROOM" &&
        call[1].data.ownerId === "user-1",
    ),
  );
});

test("acceptSubmission rejects selecting a share and a room together", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  await assert.rejects(
    () =>
      service.acceptSubmission(
        "submission-1",
        { id: "user-1" },
        {
          createShare: true,
          roomId: "room-1",
        },
      ),
    BadRequestException,
  );
  assert.equal(
    mocks.calls.filter((call) => call[0] === "asset.updateMany").length,
    0,
  );
});

test("acceptSubmission refuses rooms not owned by the inbox owner", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  await assert.rejects(
    () =>
      service.acceptSubmission(
        "submission-1",
        { id: "user-1" },
        {
          roomId: "another-room",
        },
      ),
    NotFoundException,
  );
  assert.equal(
    mocks.calls.filter((call) => call[0] === "asset.updateMany").length,
    0,
  );
});

test("rejectSubmission deletes pending assets and marks the submission rejected", async () => {
  const mocks = createServiceMock();
  const service = createInboxService(mocks);

  const rejected = await (service as any).rejectSubmission("submission-1", {
    id: "user-1",
  });

  assert.equal(rejected.status, InboxSubmissionStatus.REJECTED);
  assert.equal(
    mocks.calls.filter((call) => call[0] === "asset.remove").length,
    2,
  );
  assert.ok(
    mocks.calls.some(
      (call) =>
        call[0] === "inboxSubmission.update" &&
        call[1].data.status === InboxSubmissionStatus.REJECTED,
    ),
  );
});
