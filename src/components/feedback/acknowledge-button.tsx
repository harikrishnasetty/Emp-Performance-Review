"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/lib/client/hooks";
import { acknowledgeFeedback } from "@/app/actions/feedback";

export function AcknowledgeFeedbackButton({ feedbackId }: { feedbackId: string }) {
  const router = useRouter();
  const { pending, submit } = useFormAction(acknowledgeFeedback);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        submit(feedbackId, {
          successMessage: "Marked as read",
          onSuccess: () => router.refresh(),
        })
      }
    >
      <Check className="size-3.5" /> Acknowledge
    </Button>
  );
}
