import { createEntityId, makeWaveform } from "@frostchat/shared";
import type { Attachment } from "@frostchat/shared";

import { supabase, supabaseConfig } from "./supabase";

function inferAttachmentKind(
  fileName: string,
  mimeType?: string,
  kind?: Attachment["kind"],
): Attachment["kind"] {
  if (kind) {
    return kind;
  }

  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }
  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }
  if (normalizedMimeType.startsWith("audio/")) {
    return "voice";
  }
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(normalizedFileName)) {
    return "image";
  }
  if (/\.(mp4|mov|m4v|webm)$/i.test(normalizedFileName)) {
    return "video";
  }
  if (/\.(m4a|mp3|wav|ogg|aac)$/i.test(normalizedFileName)) {
    return "voice";
  }

  return "document";
}

function buildAttachment(input: {
  uri: string;
  fileName: string;
  mimeType?: string;
  bytes?: number;
  kind?: Attachment["kind"];
}): Attachment {
  const kind = inferAttachmentKind(input.fileName, input.mimeType, input.kind);

  return {
    id: createEntityId("att"),
    kind,
    url: input.uri,
    name: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    waveform: kind === "voice" ? makeWaveform() : undefined,
  };
}

export async function uploadAttachment(input: {
  uri: string;
  fileName: string;
  mimeType?: string;
  bytes?: number;
  kind?: Attachment["kind"];
}): Promise<Attachment> {
  const bucket = supabaseConfig.storageBucket;
  if (!supabaseConfig.url || !supabaseConfig.anonKey || !bucket) {
    return buildAttachment(input);
  }

  try {
    const response = await fetch(input.uri);
    const blob = await response.blob();
    const objectPath = `${Date.now()}-${input.fileName.replace(/[^\w.-]+/g, "-")}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.mimeType || undefined,
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return buildAttachment({
      ...input,
      uri: data.publicUrl,
      bytes: input.bytes ?? blob.size,
    });
  } catch {
    return buildAttachment(input);
  }
}
