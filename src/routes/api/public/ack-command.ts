import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ackSchema = z.object({
  command_id: z.number().int().positive(),
  device_id: z.string().trim().min(1).max(64).optional(),
  gate_pct: z.number().min(0).max(100).optional(),
});

// POST /api/public/ack-command — ESP32 confirms it has moved the gate.
export const Route = createFileRoute("/api/public/ack-command")({
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
        const parsed = ackSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid ack", issues: parsed.error.issues }, { status: 400 });
        }
        try {
          const admin = await dev.getAdmin();
          const now = new Date().toISOString();
          const { data, error } = await admin
            .from("gate_commands")
            .update({
              status: "acknowledged",
              acknowledged_at: now,
              device_id: parsed.data.device_id ?? "esp32-01",
            })
            .eq("id", parsed.data.command_id)
            .in("status", ["pending", "sent"])
            .select("id, target_pct")
            .maybeSingle();
          if (error) throw error;
          if (!data) return Response.json({ error: "Command not found or already closed" }, { status: 404 });
          return Response.json({ ok: true, command_id: data.id, target_pct: data.target_pct });
        } catch (e) {
          console.error("ack-command failed", e);
          return Response.json({ error: "Could not confirm command" }, { status: 500 });
        }
      },
    },
  },
});
