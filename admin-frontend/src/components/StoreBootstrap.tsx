"use client";

import { useEffect } from "react";
import { bootstrapAdminStores } from "@/stores/bindStores";

/** Mount once under providers to hydrate vault data and bind store subscriptions. */
export default function StoreBootstrap() {
  useEffect(() => {
    bootstrapAdminStores();
  }, []);

  return null;
}
