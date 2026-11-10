import Link from "next/link";
import { AttentionRetry } from "./attention-retry";
import type { AttentionResult } from "@/lib/dashboard-attention";
export function AttentionLoading() {
  return (
    <section
      className="attention-section"
      aria-label="Needs your attention"
      aria-busy="true"
    >
      <h2>Needs your attention</h2>
      <p role="status">Checking your actions…</p>
    </section>
  );
}
export function DashboardAttention({
  result,
  retryHref,
}: {
  result: AttentionResult;
  retryHref: string;
}) {
  return (
    <section className="attention-section" aria-labelledby="attention-heading">
      <header>
        <h2 id="attention-heading">Needs your attention</h2>
        {result.context && <p className="muted">{result.context}</p>}
      </header>
      {result.unavailable.length > 0 && (
        <div className="notice" role="status">
          <p>
            Some actions could not be checked: {result.unavailable.join(", ")}.
            This does not mean there are no pending actions.
          </p>
          <AttentionRetry href={retryHref} />
        </div>
      )}
      {result.items.length ? (
        <ul className="attention-list">
          {result.items.map((item) => (
            <li key={item.key}>
              <div>
                <h3>
                  {item.title}{" "}
                  <span className="attention-count">{item.count}</span>
                </h3>
                <span className="tag">{item.status}</span>
                <p className="muted">{item.explanation}</p>
              </div>
              <Link className="button secondary" href={item.href}>
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      ) : result.unavailable.length === 0 ? (
        <p className="notice">
          {result.emptyMessage ??
            "No pending actions in the workflows checked here. You can continue using your workspace."}
        </p>
      ) : null}
    </section>
  );
}
