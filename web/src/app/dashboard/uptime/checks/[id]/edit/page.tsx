"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useSyntheticCheckController,
  useSyntheticsController,
} from "@/controllers/synthetics";
import { SyntheticCheckBuilder } from "../../../SyntheticCheckBuilder";

/** B7 edit — the builder over an existing multi-step/browser check. */
export default function EditSyntheticCheckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const check = useSyntheticCheckController(id);
  const synthetics = useSyntheticsController();

  if (check.loading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 280 }} />
      </div>
    );
  }
  if (!check.data) {
    return (
      <div className="px-6 py-5">
        <p className="text-[13px] text-text-2">
          This synthetic check no longer exists.
        </p>
      </div>
    );
  }

  return (
    <>
      <SyntheticCheckBuilder key={check.data.id} editing={check.data} />
      <footer className="px-6 pb-6">
        <Button
          kind="destructive"
          onClick={() =>
            void synthetics.remove(check.data!.id).then(() => {
              router.push("/dashboard/uptime");
            })
          }
          data-testid="delete-check"
        >
          Delete check
        </Button>
      </footer>
    </>
  );
}
