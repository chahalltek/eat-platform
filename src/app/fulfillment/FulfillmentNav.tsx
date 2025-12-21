"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type FulfillmentNavProps = {
  canViewFulfillmentNav: boolean;
  showDecisions: boolean;
};

type NavItem = {
  label: string;
  href: string;
};

function NavLink({ item, currentPath }: { item: NavItem; currentPath: string }) {
  const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={clsx(
        "block rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
          ? "bg-indigo-50 text-indigo-700"
          : "text-zinc-700 hover:bg-zinc-100 hover:text-indigo-700",
      )}
    >
      {item.label}
    </Link>
  );
}

export function FulfillmentNav({ canViewFulfillmentNav, showDecisions }: FulfillmentNavProps) {
  const pathname = usePathname();

  if (!canViewFulfillmentNav) {
    return null;
  }

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/fulfillment" },
    { label: "Jobs", href: "/fulfillment/jobs" },
    { label: "Candidates", href: "/fulfillment/candidates" },
  ];

  if (showDecisions) {
    navItems.push({ label: "Decisions", href: "/fulfillment/decisions" });
  }

  return (
    <nav className="w-60 space-y-6" aria-label="Fulfillment">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Fulfillment</p>
        <p className="text-sm text-zinc-500">Role-based navigation</p>
      </div>
      <div className="space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} currentPath={pathname} />
        ))}
      </div>
    </nav>
  );
}
