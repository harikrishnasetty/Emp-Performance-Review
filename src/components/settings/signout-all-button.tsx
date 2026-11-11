"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/app/actions/settings";

export function SignOutAllButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onClick = () => {
    startTransition(async () => {
      try {
        const result = await signOutEverywhere();
        if (result.ok) {
          toast.success("Signed out of all devices");
          router.replace("/login");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Network error — check your connection and try again.");
      }
    });
  };

  return (
    <Button variant="danger" size="md" loading={pending} onClick={onClick}>
      <LogOut className="size-4" /> Sign out everywhere
    </Button>
  );
}
