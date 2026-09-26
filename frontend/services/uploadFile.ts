import { Platform } from "react-native";

export type UploadFile = {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string | null;
  file?: File | null;
};

/** Append an Expo picker asset as a real browser File or a native upload part. */
export async function appendUploadFile(form: FormData, field: string, asset: UploadFile, fallbackName: string) {
  const name = asset.name || fallbackName;
  const type = asset.mimeType || asset.type || "application/octet-stream";
  if (Platform.OS === "web") {
    if (asset.file) {
      form.append(field, asset.file, name);
      return;
    }
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error("Unable to read the selected file.");
    const blob = await response.blob();
    form.append(field, new File([blob], name, { type: blob.type || type }), name);
    return;
  }
  form.append(field, { uri: asset.uri, name, type } as any);
}
