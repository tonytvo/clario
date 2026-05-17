/**
 * Google Drive receipt integration.
 *
 * Flow:
 *   1. User picks a file (via <input> or drag-drop)
 *   2. uploadAndShare() uploads it to their Drive using their OAuth access token
 *   3. We automatically grant "anyone with link → reader" permission
 *   4. We return the share URL + embed URL — only these strings are stored in our DB
 *
 * Privacy: we request the `drive.file` scope only, which restricts access
 * to files the user explicitly picks through this app. We never see other Drive files.
 */

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

export interface DriveUploadResult {
  fileId: string;
  url: string;       // shareable view URL — stored in DB
  embedUrl: string;  // preview URL — for inline display
  filename: string;
}

/**
 * Upload a file to the user's Google Drive and automatically make it
 * readable by anyone with the link. Returns only the URLs — the file
 * bytes never pass through our server.
 */
export async function uploadReceiptToDrive(
  file: File,
  accessToken: string,
  folderId?: string,   // optional: upload to a specific "Clario Receipts" folder
): Promise<DriveUploadResult> {
  // 1. Upload the file
  const metadata = {
    name: `${Date.now()}_${file.name}`,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const uploadRes = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload failed: ${err}`);
  }

  const { id: fileId, name: filename, webViewLink } = await uploadRes.json();

  // 2. Automatically grant "anyone with link → reader"
  //    User does NOT need to touch sharing settings manually.
  const permRes = await fetch(`${DRIVE_FILES_URL}/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  if (!permRes.ok) {
    const err = await permRes.text();
    throw new Error(`Drive permission grant failed: ${err}`);
  }

  // 3. Build the embed URL (Google Drive preview — works in iframes)
  const embedUrl = buildEmbedUrl(webViewLink);

  return { fileId, url: webViewLink, embedUrl, filename };
}

/**
 * Ensure a "Clario Receipts" folder exists in the user's Drive.
 * Returns the folder ID. Creates it if it doesn't exist.
 * Call once per user session and cache the result.
 */
export async function ensureReceiptsFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    "name='Clario Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  );

  const searchRes = await fetch(`${DRIVE_FILES_URL}?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { files } = await searchRes.json();
  if (files?.length > 0) return files[0].id;

  // Create the folder
  const createRes = await fetch(`${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Clario Receipts",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const { id } = await createRes.json();
  return id;
}

/**
 * Convert a Google Drive view URL to a preview/embed URL.
 * https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * → https://drive.google.com/file/d/FILE_ID/preview
 */
export function buildEmbedUrl(viewUrl: string): string {
  try {
    const url = new URL(viewUrl);
    const segments = url.pathname.split("/");
    const fileIdx = segments.indexOf("d");
    if (fileIdx === -1) return viewUrl;
    const fileId = segments[fileIdx + 1];
    return `https://drive.google.com/file/d/${fileId}/preview`;
  } catch {
    return viewUrl;
  }
}

/**
 * Get the Google OAuth access token from Supabase session.
 * Supabase stores the provider token after Google OAuth sign-in.
 */
export function getDriveAccessToken(session: { provider_token?: string | null }): string {
  if (!session.provider_token) {
    throw new Error(
      "No Google Drive access token found. Make sure you signed in with Google and granted Drive access."
    );
  }
  return session.provider_token;
}
