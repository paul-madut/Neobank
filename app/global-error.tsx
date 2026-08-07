"use client"

import { useEffect } from "react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/*
  Last-resort boundary. It only fires when the root layout itself throws, which
  means nothing above it rendered - no <html>, no <body>, and no guarantee that
  globals.css was ever applied. So this file renders its own document shell,
  imports nothing, and carries its own styles.

  Like app/error.tsx, it never prints error.message: a real 500 in this app
  leaked the absolute filesystem path, the bundler chunk name, and the database
  host and port. error.digest is safe - it is the hash Next.js also writes to
  the server log, so a report can be matched to a log line without exposing
  anything about the machine.
*/
const styles = `
  :root {
    color-scheme: light dark;
    --ge-bg-from: #fafafa;
    --ge-bg-via: #f4f4f5;
    --ge-surface: #ffffff;
    --ge-border: #e4e4e7;
    --ge-title: #18181b;
    --ge-body: #52525b;
    --ge-muted: #71717a;
    --ge-chip-bg: #fafafa;
    --ge-accent-bg: #fef2f2;
    --ge-accent-border: #fecaca;
    --ge-accent-fg: #dc2626;
    --ge-button-bg: #18181b;
    --ge-button-bg-hover: #27272a;
    --ge-button-fg: #ffffff;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --ge-bg-from: #09090b;
      --ge-bg-via: #18181b;
      --ge-surface: #18181b;
      --ge-border: #27272a;
      --ge-title: #ffffff;
      --ge-body: #a1a1aa;
      --ge-muted: #71717a;
      --ge-chip-bg: rgba(39, 39, 42, 0.5);
      --ge-accent-bg: rgba(127, 29, 29, 0.2);
      --ge-accent-border: #991b1b;
      --ge-accent-fg: #f87171;
      --ge-button-bg: #ffffff;
      --ge-button-bg-hover: #f4f4f5;
      --ge-button-fg: #18181b;
    }
  }

  .ge-body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-image: linear-gradient(
      to bottom right,
      var(--ge-bg-from),
      var(--ge-bg-via),
      var(--ge-bg-from)
    );
    color: var(--ge-body);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .ge-button {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.5rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 0.375rem;
    background-color: var(--ge-button-bg);
    color: var(--ge-button-fg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .ge-button:hover {
    background-color: var(--ge-button-bg-hover);
  }

  .ge-link {
    color: var(--ge-title);
    text-decoration: none;
    font-weight: 500;
  }

  .ge-link:hover {
    text-decoration: underline;
  }
`

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Root layout error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="ge-body">
        <style>{styles}</style>

        <div style={{ maxWidth: "28rem", width: "100%" }}>
          <div
            style={{
              backgroundColor: "var(--ge-surface)",
              border: "1px solid var(--ge-border)",
              borderRadius: "1rem",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
              padding: "2rem",
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "3rem",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "9999px",
                backgroundColor: "var(--ge-accent-bg)",
                border: "1px solid var(--ge-accent-border)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--ge-accent-fg)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h1
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.875rem",
                lineHeight: 1.2,
                fontWeight: 700,
                color: "var(--ge-title)",
              }}
            >
              Something went wrong
            </h1>
            <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.6 }}>
              The app failed to start up. No balances, cards, or transfers were
              changed. Reloading usually clears it.
            </p>

            {error.digest && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--ge-chip-bg)",
                  border: "1px solid var(--ge-border)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.25rem",
                    fontSize: "0.75rem",
                    color: "var(--ge-muted)",
                  }}
                >
                  Reference for this error
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.875rem",
                    color: "var(--ge-title)",
                    wordBreak: "break-all",
                  }}
                >
                  {error.digest}
                </p>
              </div>
            )}

            <div style={{ marginTop: "2rem" }}>
              <button type="button" onClick={reset} className="ge-button">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Try again
              </button>
            </div>

            <p
              style={{
                margin: "1.5rem 0 0",
                textAlign: "center",
                fontSize: "0.875rem",
              }}
            >
              Or go{" "}
              <a href="/dashboard" className="ge-link">
                back to your dashboard
              </a>
              .
            </p>
          </div>

          <p
            style={{
              margin: "1.5rem 0 0",
              textAlign: "center",
              fontSize: "0.75rem",
              color: "var(--ge-muted)",
            }}
          >
            NeoBank is a portfolio demo. Stripe runs in test mode and Plaid in
            sandbox, so nothing here moves real money.
          </p>
        </div>
      </body>
    </html>
  )
}
