export type SectionResult<T> = {
  state: "loaded" | "empty" | "unavailable";
  items: T[];
};
/** A section failure is not an empty record. Never return provider errors to visitors. */
export async function loadSection<T>(
  read: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<SectionResult<T>> {
  try {
    const { data, error } = await read();
    if (error || !Array.isArray(data))
      return { state: "unavailable", items: [] };
    return { state: data.length ? "loaded" : "empty", items: data };
  } catch {
    return { state: "unavailable", items: [] };
  }
}
