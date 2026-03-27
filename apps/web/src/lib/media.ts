import { createEntityId, makeWaveform } from "@frostchat/shared";
import type { Attachment, UploadConfig } from "@frostchat/shared";

import { supabase, supabaseConfig } from "./supabase";

function localAttachment(file: Blob, fileName: string): Attachment {
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "voice"
        : "document";

  return {
    id: createEntityId("att"),
    kind,
    url: URL.createObjectURL(file),
    name: fileName,
    mimeType: file.type,
    bytes: file.size,
    waveform: kind === "voice" ? makeWaveform() : undefined,
  };
}

export async function uploadAttachment(file: Blob, fileName: string, config: UploadConfig): Promise<Attachment> {
  const bucket = config.bucket || supabaseConfig.storageBucket;
  if (!supabaseConfig.url || !supabaseConfig.anonKey || !bucket) {
    return localAttachment(file, fileName);
  }

  try {
    const objectPath = `${Date.now()}-${fileName.replace(/[^\w.-]+/g, "-")}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "voice"
          : "document";

    return {
      id: createEntityId("att"),
      kind,
      url: data.publicUrl,
      name: fileName,
      mimeType: file.type,
      bytes: file.size,
      waveform: kind === "voice" ? makeWaveform() : undefined,
    };
  } catch {
    return localAttachment(file, fileName);
  }
}

export function fileTypeAccept(kind: "media" | "document") {
  return kind === "media" ? "image/*,video/*,audio/*" : ".pdf,.doc,.docx,.txt,.xlsx,.csv,.zip";
}
