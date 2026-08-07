# TeraBox API notes

TeraBox exposes more than one integration surface. This distinction matters because the authentication models are not interchangeable.

## 1. Official TeraBox Open Platform

TeraBox publishes an official Open Platform integration document at:

https://www.terabox.com/integrations/docs?lang=en

As of August 2026, the official documentation describes OAuth-based authorization using application credentials obtained from TeraBox in advance. The documented flow requires values including:

- `client_id`
- `client_secret`
- `private_secret`

The platform supports authorization-code and device-code flows, producing an `access_token` and `refresh_token`. The official documentation currently states an access-token validity of 2 days and refresh-token validity of 30 days.

The official API also returns account-specific API/upload domains through its token-information flow.

### Important

The current TeraBox-SIN core client **does not implement this official OAuth/Open Platform authentication flow**.

Do not configure `TERABOX_NDUS` with an Open Platform access token, and do not expect official Open API examples to map directly to `TeraBoxApp` method calls.

## 2. TeraBox-SIN / inherited client

TeraBox-SIN is based on `seiya-npm/terabox-api`. Its current core runtime uses TeraBox web/PCS-style endpoints and authenticates with an NDUS session.

The effective public method surface is discovered at runtime:

```bash
terabox-sin methods
```

Typical installed methods include operations for:

- login/status/quota
- remote directory listing and search
- file metadata
- upload/precreate/chunks/file creation
- download
- file manager operations
- shares and share transfer
- recycle bin
- remote upload
- cloud-download tasks

The exact method set and endpoint behavior can change as the inherited implementation evolves or TeraBox changes its services.

## 3. Browser automation

`browser-automation/` is a third, separate path. It drives the normal TeraBox web UI using a dedicated Chrome profile and Playwright/CDP.

It does not convert the browser session into NDUS/OAuth credentials and does not require the official Open Platform application flow.

Use browser automation when the web UI is the desired integration surface. Keep its persistent profile local and outside source control.

## Compatibility warning

Web/PCS-style endpoints used by the inherited client are not the same stability contract as TeraBox's official Open Platform. They may change without notice.

When an operation breaks:

1. verify `terabox-sin doctor` and `terabox-sin status`;
2. confirm the method still exists with `terabox-sin methods`;
3. inspect the current implementation in `api.js`;
4. determine whether the upstream TeraBox endpoint changed;
5. only then modify the client or choose the browser workflow.

## Maintainer rule

Keep official Open Platform research and reverse-engineered/inherited endpoint research clearly separated in documentation and code comments. Never present an inherited/private endpoint as an official supported Open Platform API.
