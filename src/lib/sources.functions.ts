import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "./device.server";
import { syncSource } from "./sources/sync.server";

export const syncSourceNow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ source_id: z.enum(["esp32", "gpm_imerg", "swot", "sentinel1", "srtm"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    try {
      const r = await syncSource(admin, data.source_id);
      return { ok: r.ok, message: r.message };
    } catch (e) {
      console.error("sync failed", data.source_id, e);
      return { ok: false, message: "Sync failed. Try again in a minute." };
    }
  });
