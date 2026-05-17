# ADR-001: Store receipts in user's Google Drive, not on our servers

**Date:** 2025-05-17
**Status:** Accepted

## Context

Clario needs to support attaching receipt images and PDFs to expenses. The naive approach is to upload files to our own storage (Supabase Storage / S3). This has costs and privacy implications.

## Decision

Receipt files are stored in the user's own Google Drive. Clario only stores a shareable URL string in the `receipt_links` table. The app uses the Google Drive API with the `drive.file` scope to:

1. Upload the file to the user's Drive automatically (no manual sharing required)
2. Grant "anyone with link → reader" permission programmatically
3. Return the share URL, which is saved in our database

## Consequences

**Positive:**
- Zero storage cost on our side — runs free indefinitely
- Users own their data; deleting their Google account removes their files
- Privacy: we never see the file contents
- `drive.file` scope is minimal — we can only access files the user explicitly picks through our app

**Negative:**
- If user deletes/moves the file from Drive, the link breaks in the app
- Requires Google account (or Dropbox as an alternative in a future ADR)
- Cannot do server-side OCR or thumbnail generation

## Alternatives considered

- **Supabase Storage**: costs money at scale, files stored on our servers
- **Ask user to paste a manual share link**: bad UX, user must remember to set sharing settings
- **PocketBase self-hosted**: viable alternative for self-hosters, documented in README
