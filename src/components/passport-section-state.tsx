import { AttentionRetry } from "./attention-retry";
export function PassportSectionState({
  title,
  state,
  href,
}: {
  title: string;
  state: "loading" | "unavailable" | "empty";
  href?: string;
}) {
  return (
    <section
      className="section-spacer passport-section-state"
      aria-label={title}
      aria-busy={state === "loading"}
    >
      <h2>{title}</h2>
      <p
        className={state === "unavailable" ? "notice" : "muted"}
        role={state === "empty" ? undefined : "status"}
      >
        {state === "loading"
          ? `Loading ${title.toLowerCase()}…`
          : state === "unavailable"
            ? "This section could not be loaded. Other available sections are still shown. Please try again."
            : "No records are shared in this section."}
      </p>
      {state === "unavailable" && (
        <AttentionRetry href={href ?? "/portal/talent/passport"} />
      )}
    </section>
  );
}
