"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

const VIEW_ID = "DOCS";

export default function DrivePickerButton({
  accessToken,
  developerKey,
  appId,
  onPicked
}) {
  const openPicker = useCallback(() => {
    if (!accessToken || !window.google || !window.gapi) {
      return;
    }

    window.gapi.load("picker", {
      callback: () => {
        const view = new window.google.picker.View(
          window.google.picker.ViewId[VIEW_ID]
        );
        view.setMimeTypes("video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,image/*");

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(accessToken)
          .setDeveloperKey(developerKey)
          .setAppId(appId)
          .setTitle("Selecionar Evidências do Drive")
          .setCallback((data) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const files = data.docs.map((doc) => ({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType
              }));
              onPicked(files);
            }
          })
          .build();

        picker.setVisible(true);
      }
    });
  }, [accessToken, appId, developerKey, onPicked]);

  return (
    <Button
      variant="outline"
      onClick={openPicker}
      disabled={!accessToken}
      className="gap-2"
    >
      <FolderOpen className="h-4 w-4" />
      Select from Google Drive
    </Button>
  );
}
