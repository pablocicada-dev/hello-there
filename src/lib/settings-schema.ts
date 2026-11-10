import { z } from "zod";

export const settingsSchema = z
  .object({
    area_name: z.string().trim().min(1, "Enter an area name").max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    danger_level: z.number().min(0).max(20),
    drain_start: z.number().min(0).max(20),
    drain_stop: z.number().min(0).max(20),
    min_head: z.number().min(0).max(5),
    salinity_limit: z.number().positive().max(100),
    rain_alert_3h: z.number().positive().max(1000),
  })
  .refine((s) => s.drain_stop < s.drain_start, {
    message: "Drain stop must be lower than drain start",
    path: ["drain_stop"],
  })
  .refine((s) => s.drain_start < s.danger_level, {
    message: "Drain start must be lower than the danger level",
    path: ["drain_start"],
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

/** Example values only. Replace with the real levels for your polder. */
export const DEFAULT_THRESHOLDS = {
  danger_level: 3.4,
  drain_start: 2.2,
  drain_stop: 1.9,
  min_head: 0.1,
  salinity_limit: 2.0,
  rain_alert_3h: 25,
};
