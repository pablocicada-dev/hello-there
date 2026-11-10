import { createFileRoute } from "@tanstack/react-router";

// POST /api/public/ingest-reading — ESP32 sends one reading; the decision engine runs after it.
export const Route = createFileRoute("/api/public/ingest-reading")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const dev = await import("@/lib/device.server");
        const denied = dev.checkDeviceKey(request);
        if (denied) return denied;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Body must be JSON" }, { status: 400 });
        }
        const parsed = dev.readingSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid reading", issues: parsed.error.issues }, { status: 400 });
        }
        try {
          const admin = await dev.getAdmin();
          const { reading, decision } = await dev.saveReadingAndDecide(admin, parsed.data);
          return Response.json({
            ok: true,
            reading_id: reading.id,
            mode: decision.mode,
            target_pct: decision.targetPct,
            reason: decision.reason,
          });
        } catch (e) {
          console.error("ingest-reading failed", e);
          return Response.json({ error: "Could not save reading" }, { status: 500 });
        }
      },
    },
  },
});
