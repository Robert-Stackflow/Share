import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ImageVisibility } from "@prisma/client";
import { Request } from "express";
import { parseHostedImageUpload } from "./image.controller";

const createRequest = (input: {
  body?: unknown;
  contentType?: string;
  fileName?: string;
  visibility?: string;
}) =>
  ({
    body: input.body,
    query: input.visibility ? { visibility: input.visibility } : {},
    headers: {
      ...(input.contentType ? { "content-type": input.contentType } : {}),
      ...(input.fileName ? { "x-file-name": input.fileName } : {}),
    },
  }) as unknown as Request;

test("accepts raw image bytes for generic image upload clients", () => {
  const body = Buffer.from("png-bytes");
  const result = parseHostedImageUpload(
    undefined,
    createRequest({
      body,
      contentType: "image/png",
      fileName: "Clipper%20capture.png",
    }),
  );

  assert.equal(result.file?.buffer, body);
  assert.equal(result.file?.mimetype, "image/png");
  assert.equal(result.file?.originalname, "Clipper capture.png");
  assert.equal(result.visibility, undefined);
});

test("keeps multipart uploads and reads their visibility", () => {
  const file = { originalname: "pixel.png" } as Express.Multer.File;
  const request = createRequest({ body: { visibility: "PRIVATE" } });
  const result = parseHostedImageUpload(file, request);

  assert.equal(result.file, file);
  assert.equal(result.visibility, ImageVisibility.PRIVATE);
});

test("rejects invalid visibility before attempting an upload", () => {
  assert.throws(
    () =>
      parseHostedImageUpload(
        undefined,
        createRequest({
          body: Buffer.from("png-bytes"),
          contentType: "image/png",
          visibility: "SECRET",
        }),
      ),
    /Image visibility must be PUBLIC or PRIVATE/,
  );
});
