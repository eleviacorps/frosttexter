import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "@/store/useAppStore";

export function HiddenVaultEntryDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const secretPin = useAppStore((state) => state.secretPin);
  const setSecretPin = useAppStore((state) => state.setSecretPin);
  const unlockSecret = useAppStore((state) => state.unlockSecret);
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string>();

  if (!open) {
    return null;
  }

  const fallbackPin = secretPin ?? "111222";

  function handleSubmit() {
    const trimmed = value.trim();

    if (!trimmed) {
      setNote("Nothing changed.");
      return;
    }

    if (!secretPin && trimmed === fallbackPin) {
      setSecretPin(fallbackPin);
      setValue("");
      setNote(undefined);
      onClose();
      navigate("/secret");
      return;
    }

    if (unlockSecret(trimmed)) {
      setValue("");
      setNote(undefined);
      onClose();
      navigate("/secret");
      return;
    }

    setNote("Nothing changed.");
    window.setTimeout(() => {
      onClose();
      setValue("");
      setNote(undefined);
    }, 500);
  }

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[#182033] bg-[rgba(10,10,12,0.97)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/32">Workspace</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Private access</h3>
        <p className="mt-2 text-sm leading-6 text-white/46">
          Enter your workspace passcode to continue.
        </p>

        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Passcode"
          className="mt-5 w-full rounded-2xl border border-[#1a2336] bg-[#111215] px-4 py-3 text-white outline-none"
        />

        {note ? <p className="mt-3 text-sm text-white/46">{note}</p> : null}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setValue("");
              setNote(undefined);
              onClose();
            }}
            className="rounded-2xl border border-[#1a2336] bg-white/[0.04] px-4 py-3 text-sm text-white/72"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-[#d5f575] px-4 py-3 text-sm font-medium text-black"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
