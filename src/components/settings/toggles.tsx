"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useToast } from "@/components/toast";
import {
  archiveAddon,
  archiveSetOption,
  archiveStudioSet,
  setUserActive,
} from "@/server/actions/settings";

import { RowAction } from "./form";

type Kind = "set" | "option" | "addon";

const ACTIONS: Record<Kind, (id: string, isActive: boolean) => Promise<{ message?: string }>> = {
  set: archiveStudioSet,
  option: archiveSetOption,
  addon: archiveAddon,
};

/** Archive/restore for sets, options and add-ons — never a hard delete. */
export function ArchiveToggle({
  kind,
  id,
  isActive,
}: {
  kind: Kind;
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <RowAction
      danger={isActive}
      onClick={() =>
        start(async () => {
          const result = await ACTIONS[kind](id, !isActive);
          if (result.message) toast(result.message);
          router.refresh();
        })
      }
    >
      {pending ? "Working…" : isActive ? "Archive" : "Restore"}
    </RowAction>
  );
}

/** Deactivate/reactivate a team account. */
export function UserActiveToggle({
  id,
  isActive,
  isSelf,
}: {
  id: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const { toast, error } = useToast();
  const [pending, start] = useTransition();

  if (isSelf && isActive) {
    return <span className="text-[0.8125rem] text-line-strong">This is you</span>;
  }

  return (
    <RowAction
      danger={isActive}
      onClick={() =>
        start(async () => {
          const result = await setUserActive(id, !isActive);
          if (result.ok === false) error(result.message ?? "That did not work.");
          else if (result.message) toast(result.message);
          router.refresh();
        })
      }
    >
      {pending ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
    </RowAction>
  );
}
