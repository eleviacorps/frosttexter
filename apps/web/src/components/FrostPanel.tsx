import clsx from "clsx";
import type { PropsWithChildren } from "react";

export function FrostPanel({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={clsx(
        "rounded-[26px] border border-[#182033] bg-[rgba(9,9,12,0.9)] shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
