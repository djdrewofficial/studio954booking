"use client";

import { Button } from "./ui";

export function PrintButton({ label = "Print prep sheet" }: { label?: string }) {
  return (
    <Button variant="primary" onClick={() => window.print()} data-print="hide">
      {label}
    </Button>
  );
}
