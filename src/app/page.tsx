import Link from "next/link";

const links = [
  { label: "Run RINA", href: "/rina-test" },
  { label: "Agent Runs", href: "/agents/runs" },
  { label: "RUA (Role Intake)", href: "/rua-test" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 py-16 sm:px-12">
        <header className="mt-8 flex flex-col gap-3 sm:mt-12">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            EAT
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            EAT – Talent System (MVP)
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Quick links to the core workflows for the EDGE (Emerging, Disruptive &
            Growth Enabling) Agent Toolkit.
          </p>
        </header>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{link.label}</h2>
                <span className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 transition group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-300 dark:group-hover:border-indigo-600/60 dark:group-hover:bg-indigo-600/10 dark:group-hover:text-indigo-300">
                  Open
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {link.label} workflow
              </p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
