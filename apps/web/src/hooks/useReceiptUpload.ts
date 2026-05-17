/**
 * useReceiptUpload
 *
 * Handles the full receipt attachment flow:
 *   1. Gets the user's Google Drive access token from Supabase session
 *   2. Ensures the "Clario Receipts" folder exists in their Drive
 *   3. Uploads the file directly to their Drive (never hits our server)
 *   4. Auto-grants "anyone with link" read permission
 *   5. Saves only the URL to our database (receipt_links table)
 *
 * Users never touch Google Drive sharing settings manually.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  uploadReceiptToDrive,
  ensureReceiptsFolder,
  getDriveAccessToken,
} from "@/lib/gdrive/drive";

interface UploadState {
  uploading: boolean;
  error: string | null;
  progress: number;
}

export function useReceiptUpload(expenseId: string) {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    error: null,
    progress: 0,
  });

  const supabase = createClient();

  async function upload(file: File) {
    setState({ uploading: true, error: null, progress: 10 });

    try {
      // 1. Get session + Drive token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const accessToken = getDriveAccessToken(session);
      setState(s => ({ ...s, progress: 20 }));

      // 2. Ensure Clario folder exists in user's Drive
      const folderId = await ensureReceiptsFolder(accessToken);
      setState(s => ({ ...s, progress: 40 }));

      // 3. Upload to Drive + auto-share
      const result = await uploadReceiptToDrive(file, accessToken, folderId);
      setState(s => ({ ...s, progress: 80 }));

      // 4. Save only the link to our DB — file bytes never touched our server
      const { error: dbError } = await supabase.from("receipt_links").insert({
        expense_id: expenseId,
        uploaded_by: session.user.id,
        url: result.url,
        embed_url: result.embedUrl,
        provider: "google_drive",
        filename: result.filename,
      });

      if (dbError) throw dbError;

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
