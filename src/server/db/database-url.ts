export function describeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(/:$/, "") || "unknown-protocol";
    const hasHost = Boolean(parsed.hostname);
    const hasDatabaseName = Boolean(parsed.pathname && parsed.pathname !== "/");

    const hostDescription = hasHost ? "<redacted-host>" : "unknown-host";
    const databaseDescription = hasDatabaseName ? "<redacted-db>" : "unknown-db";
    const portDescription = parsed.port ? ":<redacted-port>" : "";

    return `${protocol}://${hostDescription}${portDescription}/${databaseDescription}`;
  } catch {
    return "an invalid DATABASE_URL";
  }
}
