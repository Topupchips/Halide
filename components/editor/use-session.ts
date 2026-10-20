"use client";

import { getSession } from "@/lib/editor/session";
import { useEffect, useState } from "react";

export function useSession() {
  const session = getSession();
  const [, setTick] = useState(0);
  useEffect(
    () =>
      session.subscribe((event) => {
        if (event === "change" || event === "view") setTick((tick) => tick + 1);
      }),
    [session],
  );
  return session;
}
