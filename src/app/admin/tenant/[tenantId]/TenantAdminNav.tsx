"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

function NavLink({ label, href, currentPath }: { label: string; href: string; currentPath: string }) {
  const isActive = currentPath.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "block rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
          ? "bg-indigo-50 text-indigo-700"
          : "text-zinc-700 hover:bg-zinc-100 hover:text-indigo-700"
      )}
    >
      {label}
    </Link>
  );
}

export function TenantAdminNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();

  const navSections = [
    {
      label: "Guardrails",
      items: [
        { label: "Guardrails Presets", href: `/admin/tenant/${tenantId}/guardrails` },
        { label: "Diagnostics", href: `/admin/tenant/${tenantId}/diagnostics` },
      ],
    },
    {
      label: "Operations",
      items: [{ label: "Runbook", href: `/admin/tenant/${tenantId}/operations-runbook` }],
    },
    {
      label: "Ops",
      items: [
        { label: "Test Runner", href: `/admin/tenant/${tenantId}/ops/test-runner` },
        { label: "Runtime Controls", href: `/admin/tenant/${tenantId}/ops/runtime-controls` },
      ],
    },
  ];

  return (
    <nav className="w-60 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Tenant Admin</p>
        <p className="text-sm text-zinc-500">{tenantId}</p>
      </div>

      <div className="space-y-4">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink key={item.href} label={item.label} href={item.href} currentPath={pathname} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
