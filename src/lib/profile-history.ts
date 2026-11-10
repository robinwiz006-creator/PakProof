import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Enter a valid date",
  );
export const historySchema = z
  .object({
    kind: z.enum(["education", "employment"]),
    organization: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(160),
    field: z.string().trim().max(160).default(""),
    start_date: date,
    end_date: z.union([date, z.literal("")]),
    ongoing: z.boolean(),
    description: z.string().trim().max(2000),
    is_public: z.boolean(),
  })
  .refine(
    (v) =>
      v.ongoing
        ? !v.end_date
        : Boolean(v.end_date && v.end_date >= v.start_date),
    "Provide an end date after the start date, or select ongoing and clear the end date",
  );
export type HistoryInput = z.infer<typeof historySchema>;
export type HistoryRecord = Omit<HistoryInput, "end_date"> & {
  id: string;
  end_date: string | null;
};
