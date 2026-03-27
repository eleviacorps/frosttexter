import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  Mic,
  Paperclip,
  Reply,
  SendHorizonal,
  Sparkles,
  Trash2,
} from "lucide-react";

import type { Attachment, Conversation } from "@frostchat/shared";

import { fileTypeAccept, uploadAttachment } from "@/lib/media";
import { useAppStore } from "@/store/useAppStore";

export function MessageComposer({
  conversation,
  onSend,
  onTyping,
}: {
  conversation: Conversation | { id: string; kind: "room"; title: string; participantIds: string[]; updatedAt: string };
  onSend: (payload: { body: string; attachments?: Attachment[]; selfDestructSeconds?: number }) => Promise<void> | void;
  onTyping: (active: boolean) => void;
}) {
  const uploadConfig = useAppStore((state) => state.uploadConfig);
  const replyTo = useAppStore((state) => state.replyTo);
  const setReplyTo = useAppStore((state) => state.setReplyTo);
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfDestructSeconds, setSelfDestructSeconds] = useState<number | undefined>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<number | undefined>(undefined);
  const resolvedUploadConfig = uploadConfig ?? { bucket: "attachments" };

  useEffect(
    () => () => {
      window.clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const attachment = await uploadAttachment(file, file.name, resolvedUploadConfig);
      setAttachments((current) => [...current, attachment]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const attachment = await uploadAttachment(
        blob,
        `voice-${Date.now()}.webm`,
        resolvedUploadConfig,
      );
      setAttachments((current) => [...current, attachment]);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  async function submit() {
    if (!value.trim() && !attachments.length) {
      return;
    }

    await onSend({ body: value.trim(), attachments, selfDestructSeconds });
    setValue("");
    setAttachments([]);
    setSelfDestructSeconds(undefined);
    setReplyTo(undefined);
    onTyping(false);
  }

  return (
    <div className="border-t border-[#182033] bg-[#0b0c0f] px-4 py-4">
      {replyTo ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#1a2336] bg-[#121317] px-4 py-3 text-sm text-white/72">
          <div className="flex min-w-0 items-center gap-3">
            <Reply size={15} className="shrink-0 text-[#d5f575]" />
            <p className="truncate">
              Replying to <span className="font-medium text-white">{replyTo.body || "attachment"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(undefined)}
            className="text-white/38 transition hover:text-white"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      {attachments.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="rounded-2xl border border-[#1a2336] bg-[#121317] px-3 py-2 text-xs text-white/68"
            >
              {attachment.name}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="flex min-w-0 flex-1 items-end gap-3 rounded-[24px] border border-[#1a2336] bg-[#121317] px-3 py-3">
          <textarea
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              onTyping(true);
              window.clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1200);
            }}
            rows={1}
            placeholder={
              conversation.kind === "secret"
                ? "Write an encrypted message"
                : conversation.kind === "room"
                  ? "Say something to the room"
                  : "Write a message"
            }
            className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/28"
          />

          <div className="flex shrink-0 gap-2">
            <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-[#1a2336] bg-[#0d0e11] text-white/72 transition hover:border-[#24304b] hover:text-white">
              <Paperclip size={17} />
              <input
                type="file"
                className="hidden"
                accept={fileTypeAccept("media")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleUpload(file);
                  }
                }}
              />
            </label>

            <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-2xl border border-[#1a2336] bg-[#0d0e11] text-white/72 transition hover:border-[#24304b] hover:text-white">
              <Sparkles size={17} />
              <input
                type="file"
                className="hidden"
                accept={fileTypeAccept("document")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleUpload(file);
                  }
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => void toggleRecording()}
              className={recording
                ? "grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/40 bg-rose-500/14 text-rose-100 transition"
                : "grid h-11 w-11 place-items-center rounded-2xl border border-[#1a2336] bg-[#0d0e11] text-white/72 transition hover:border-[#24304b] hover:text-white"}
            >
              <Mic size={17} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 xl:justify-end">
          {conversation.kind === "secret" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-[#1a2336] bg-[#121317] px-3 py-2.5 text-xs text-white/65">
              <Clock3 size={14} className="text-white/45" />
              <select
                value={selfDestructSeconds ?? ""}
                onChange={(event) =>
                  setSelfDestructSeconds(event.target.value ? Number(event.target.value) : undefined)
                }
                className="bg-transparent text-xs text-white outline-none"
              >
                <option value="">No timer</option>
                <option value="10">10s</option>
                <option value="60">1m</option>
                <option value="3600">1h</option>
              </select>
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#d5f575] px-5 text-sm font-medium text-black transition hover:brightness-105 disabled:opacity-40"
          >
            <SendHorizonal size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
