import { useCallback } from "react";

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
        view.setMimeTypes("video/mp4,image/*");

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
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
    <button
      type="button"
      onClick={openPicker}
      disabled={!accessToken}
      className="rounded-md border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Selecionar Evidências do Drive
    </button>
  );
}
