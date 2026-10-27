/**
 * useReceiptUpload
 *
 * Handles the full receipt attachment flow:
 *   1. Takes the user's Google Drive access token (Google sign-in flow TBD)
 *   2. Ensures the "Clario Receipts" folder exists in their Drive
 *   3. Uploads the file directly to their Drive (never hits our server)
 *   4. Auto-grants "anyone with link" read permission
 *   5. Attaches only the URL to the expense via the attach_receipt tool
 *
 * Users never touch Google Drive sharing settings manually.
 */

import { useState } from "react";
import { callTool } from "@/lib/api";
import { uploadReceiptToDrive, ensureReceiptsFolder } from "@/lib/gdrive/drive";

interface UploadState {
  uploading: boolean;
  error: string | null;
  progress: number;
}

export function useReceiptUpload(expenseId: string, driveAccessToken: string | null) {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    error: null,
    progress: 0,
  });

  async function upload(file: File) {
    setState({ uploading: true, error: null, progress: 10 });

    try {
      // 1. Drive token
      if (!driveAccessToken) {
        throw new Error("No Google Drive access token. Connect your Google account first.");
      }
      setState(s => ({ ...s, progress: 20 }));

      // 2. Ensure Clario folder exists in user's Drive
      const folderId = await ensureReceiptsFolder(driveAccessToken);
      setState(s => ({ ...s, progress: 40 }));

      // 3. Upload to Drive + auto-share
      const result = await uploadReceiptToDrive(file, driveAccessToken, folderId);
      setState(s => ({ ...s, progress: 80 }));

      // 4. Attach only the link to the expense — file bytes never touched our server
      await callTool("attach_receipt", {
        expense_id: expenseId,
        url: result.url,
        provider: "google_drive",
        filename: result.filename,
      });

      setState({ uploading: false, error: null, progress: 100 });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setState({ uploading: false, error: message, progress: 0 });
      throw err;
    }
  }

  return { upload, ...state };
}
