---
sidebar_position: 7
title: WebDAV and image hosting
---

Share can expose a private WebDAV workspace backed by the configured S3 bucket and can host images using the same asset storage layer as regular uploads.

## App credentials

Open **My account → Security → App credentials** to create a credential. The secret is shown only once.

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

Open **Content & sharing → Images** to upload, paste, preview, search, and delete images. JPEG, PNG, WebP, GIF, and AVIF files up to 25 MB are accepted. SVG is intentionally rejected.

Public images receive a stable `/i/{slug}` URL and copy-ready direct, Markdown, HTML, and BBCode formats. Private images are available only through an authenticated account or an Image API token.

### Upload API

Send a multipart request with the token in the Bearer authorization header:

```bash
curl -X POST \
  -H "Authorization: Bearer share_your_token" \
  -F "visibility=PUBLIC" \
  -F "file=@photo.png" \
  https://share.example.com/api/image-api/images
```

`visibility` can be `PUBLIC` or `PRIVATE`. The response contains the image metadata and, for public images, direct, Markdown, HTML, and BBCode links.

The API also supports:

- `GET /api/image-api/images`
- `PATCH /api/image-api/images/{id}`
- `GET /api/image-api/images/{id}/content`
- `DELETE /api/image-api/images/{id}`

This is Share's own API and does not emulate the Lsky Pro upload API.
