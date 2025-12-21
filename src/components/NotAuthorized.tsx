import Link from "next/link";

type NotAuthorizedProps = {
  title?: string;
  message?: string;
  showHomeLink?: boolean;
};

export function NotAuthorized({
  title = "Not authorized",
  message = "You do not have permission to view this page.",
  showHomeLink = true,
}: NotAuthorizedProps) {
  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-amber-800">{message}</p>
      {showHomeLink ? (
        <div className="mt-4">
          <Link href="/" className="text-sm font-medium text-amber-900 underline">
            Back to Console
          </Link>
        </div>
      ) : null}
    </div>
  );
}
