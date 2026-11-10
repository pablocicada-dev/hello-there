import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/pending-command?device_id=esp32-01 — ESP32 polls for the newest command.
// Returns 204 when nothing is pending. Marks the returned command as "sent".
export const Route = createFileRoute("/api/public/pending-command")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const dev = await import("@/lib/device.server");
        const denied = dev.checkDeviceKey(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const deviceId = (url.searchParams.get("device_id") ?? "esp32-01").slice(0, 64);
        try {
          const admin = await dev.getAdmin();
          // Heartbeat: keeps the 30-min fail-safe working even when readings stop.
          const { runEngine } = await import("@/lib/gate.server");
          await runEngine(admin, "poll");
          const { data } = await admin
            .from("gate_commands")
            .select("id, created_at, target_pct, source, status, reason")
            .in("status", ["pending", "sent"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!data) return new Response(null, { status: 204 });
          if (data.status === "pending") {
            await admin
              .from("gate_commands")
              .update({ status: "sent", sent_at: new Date().toISOString(), device_id: deviceId })
              .eq("id", data.id);
          }
          return Response.json({
            command_id: data.id,
            target_pct: data.target_pct,
            source: data.source,
            reason: data.reason,
            created_at: data.created_at,
          });
        } catch (e) {
          console.error("pending-command failed", e);
          return Response.json({ error: "Could not read commands" }, { status: 500 });
        }
      },
    },
  },
});
