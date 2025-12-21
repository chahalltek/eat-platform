import Link from "next/link";

type DeepLinkBannerProps = {
  from?: string | null;
  returnUrl?: string | null;
};

export function DeepLinkBanner({ from, returnUrl }: DeepLinkBannerProps) {
  if (!from && !returnUrl) {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden>📌</span>
          <p className="font-semibold">
            {from ? (
              <>
                Opened from <span className="font-bold">{from}</span>
              </>
            ) : (
              "Deep link"
            )}
          </p>
        </div>
        {returnUrl ? (
          <Link
            href={returnUrl}
            rel="noreferrer noopener"
            target="_blank"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-900 underline underline-offset-4 transition hover:text-indigo-700 dark:text-indigo-100 dark:hover:text-indigo-50"
          >
            Return to source
            <span aria-hidden>↗</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
