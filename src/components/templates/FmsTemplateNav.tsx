"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "FMS Template", href: "/Templates/fms-template" },
  { label: "Manage Templates", href: "/Templates/fms-template/manage" },
  { label: "Table View", href: "/Templates/fms-template/table" },
  { label: "Flow View", href: "/Templates/fms-template/flow" },
  { label: "New Project", href: "/Templates/new-project" },
  { label: "Projects", href: "/Templates/projects" },
  { label: "Delete Approval", href: "/Templates/projects/delete-approval" },
];

export default function FmsTemplateNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {links.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href === "/Templates/fms-template/manage" && pathname === "/Templates/fms-template/manage") ||
          (link.href === "/Templates/projects" && pathname.startsWith("/Templates/projects/") && pathname !== "/Templates/projects/delete-approval");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
