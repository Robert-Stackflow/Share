---
sidebar_position: 7
title: WebDAV and image hosting
---

Share can expose a private WebDAV workspace backed by the configured S3 bucket and can host images using the same asset storage layer as regular uploads.

## App credentials

Open **My account → API keys** to create a credential. The secret is shown only once.

- A **WebDAV password** can only use the `webdav:read` and `webdav:write` scopes.
- An **Image API token** can only use the `image:read` and `image:write` scopes.
- Credentials can be read-only, given an expiry date, or revoked without changing the account password.

## WebDAV

WebDAV requires S3 storage to be enabled. Configure a client with:

Administrators can enable or disable the endpoint and enforce read-only access under **Administration → Configuration → WebDAV**.

- Server address: `https://share.example.com/dav/`
- Username: the Share username or email address
- Password: the generated WebDAV app password

Each account is isolated under its own S3 prefix. Standard file and directory operations, range downloads, copy, move, and delete are supported.

## Image hosting

Open **Content & sharing → Images** to enter the image workspace. Its sidebar contains:

- **Library** for upload, search, sort, visibility, albums, tags, favorites, and batch actions.
- **Albums** for creating and maintaining collections without changing existing image links.
- **Recycle bin** for restoring deleted images or permanently deleting their files.
- **Upload settings** for default visibility, deduplication, resize, format/quality conversion, metadata removal, orientation correction, and text watermarks.
- **Clients & API** for endpoint and request-header examples.

JPEG, PNG, WebP, GIF, and AVIF are accepted. SVG is intentionally rejected. Animated images are retained without destructive processing. When a still image is processed, Share retains the original and exposes it to the owner from the image details dialog.

Administrators can control web and API uploads, public links, default visibility, per-image byte and pixel limits, thumbnail size, processing, per-user quota, upload rate, recycle-bin retention, public image domain, and cache lifetime under **Administration → Configuration → Image hosting**. **Administration → Image management** provides global usage statistics and owner-aware moderation.

Public images receive a stable `/i/{slug}` URL and copy-ready direct, Markdown, HTML, and BBCode formats. Their thumbnails use `/i/{slug}/thumbnail`. Private images are available only through an authenticated account or an Image API token. Public responses include configurable browser/CDN cache headers, and the public origin can be replaced with a dedicated image or CDN domain.

### Upload API

Send a multipart request with the token in the Bearer authorization header:

```bash
curl -X POST \
  -H "Authorization: Bearer share_your_token" \
  -F "visibility=PUBLIC" \
  -F "file=@photo.png" \
  https://share.example.com/api/image-api/images
```

Generic clients may also send the original image bytes directly:

```bash
curl -X POST \
  -H "Authorization: Bearer share_your_token" \
  -H "Content-Type: image/png" \
  -H "X-File-Name: photo.png" \
  -H "X-Image-Visibility: PUBLIC" \
  -H "X-Image-Album: optional-album-uuid" \
  --data-binary @photo.png \
  https://share.example.com/api/image-api/images
```

`visibility` can be `PUBLIC` or `PRIVATE`, and `albumId` can contain one of the user's album UUIDs. For raw uploads these values can be sent as query parameters or as the `X-Image-Visibility` and `X-Image-Album` headers. The response contains image metadata, thumbnail and original endpoints, and, for public images, direct, Markdown, HTML, and BBCode links.

The API also supports:

- `GET /api/image-api/images` with cursor pagination and optional `q`, `visibility`, `albumId`, `tag`, `favorite`, `sort`, and `limit` filters
- `GET /api/image-api/images/stats`
- `PATCH /api/image-api/images/batch`
- `DELETE /api/image-api/images/batch`
- `PATCH /api/image-api/images/{id}`
- `GET /api/image-api/images/{id}/content`
- `DELETE /api/image-api/images/{id}`

The authenticated web API additionally exposes album, preference, recycle-bin restore, original download, thumbnail, and permanent-delete routes used by the image workspace.

This is Share's own API and does not emulate the Lsky Pro upload API.
