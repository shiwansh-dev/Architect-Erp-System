import React, { useMemo } from 'react';

interface PermissionSelectorProps {
  selected: string[];
  onChange: (paths: string[]) => void;
}

// Define sections and pages here. Keep in sync with AppSidebar items.
const SECTIONS: { label: string; items: { label: string; path: string }[] }[] = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Ecommerce', path: '/ecommerce' },
    ],
  },
  {
    label: 'Calendar',
    items: [{ label: 'Calendar', path: '/calendar' }],
  },
  {
    label: 'User',
    items: [
      { label: 'Profile', path: '/profile' },
      { label: 'Users', path: '/users' },
    ],
  },
  {
    label: 'Master',
    items: [
      { label: 'Items', path: '/Master/Items' },
      { label: 'Unit', path: '/Master/Unit' },
      { label: 'Item Type', path: '/Master/itemtype' },
      { label: 'Machine', path: '/Master/machine' },
      { label: 'Process', path: '/Master/process-links' },
      { label: 'Customer', path: '/Master/customers' },
      { label: 'Roles', path: '/Master/roles' },
    ],
  },
  {
    label: 'Templates',
    items: [
      { label: 'FMS Template', path: '/Templates/fms-template' },
      { label: 'FMS Template Table', path: '/Templates/fms-template/table' },
      { label: 'FMS Template Flow', path: '/Templates/fms-template/flow' },
    ],
  },
  {
    label: 'Projects',
    items: [
      { label: 'Projects', path: '/Templates/projects' },
      { label: 'New Project', path: '/Templates/new-project' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Delete Approval', path: '/Templates/projects/delete-approval' },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);
const ALL_PATHS = ALL_ITEMS.map((item) => item.path);
const PATH_LABELS = new Map(ALL_ITEMS.map((item) => [item.path, item.label]));

const orderSelectedPaths = (paths: string[], firstPath?: string) => {
  const selectedSet = new Set(paths.filter((path) => ALL_PATHS.includes(path)));
  const orderedPaths = ALL_PATHS.filter((path) => selectedSet.has(path));

  if (!firstPath || !selectedSet.has(firstPath)) {
    return orderedPaths;
  }

  return [firstPath, ...orderedPaths.filter((path) => path !== firstPath)];
};

const PermissionSelector: React.FC<PermissionSelectorProps> = ({ selected, onChange }) => {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const orderedSelectedPaths = useMemo(() => orderSelectedPaths(selected, selected[0]), [selected]);
  const firstPath = orderedSelectedPaths[0] || "";

  const toggle = (path: string) => {
    const next = new Set(selectedSet);
    const currentFirstPath = selected[0];

    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }

    const preferredFirstPath =
      currentFirstPath && currentFirstPath !== path && next.has(currentFirstPath)
        ? currentFirstPath
        : next.has(path)
          ? path
          : undefined;

    onChange(orderSelectedPaths(Array.from(next), preferredFirstPath));
  };

  const toggleSection = (paths: string[]) => {
    const allSelected = paths.every((p) => selectedSet.has(p));
    const next = new Set(selectedSet);
    const currentFirstPath = selected[0];

    if (allSelected) {
      paths.forEach((p) => next.delete(p));
    } else {
      paths.forEach((p) => next.add(p));
    }

    const preferredFirstPath = currentFirstPath && next.has(currentFirstPath) ? currentFirstPath : undefined;
    onChange(orderSelectedPaths(Array.from(next), preferredFirstPath));
  };

  const handleFirstPageChange = (path: string) => {
    onChange(orderSelectedPaths(selected, path));
  };

  return (
    <div className="space-y-3">
      <div className="rounded border border-stroke p-3 dark:border-strokedark">
        <label className="mb-2 block text-sm font-medium text-gray-800 dark:text-gray-200">
          First Page
        </label>
        <select
          value={firstPath}
          onChange={(e) => handleFirstPageChange(e.target.value)}
          disabled={orderedSelectedPaths.length === 0}
          className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-strokedark dark:bg-boxdark"
        >
          {orderedSelectedPaths.length === 0 ? (
            <option value="">Select at least one allowed page</option>
          ) : null}
          {orderedSelectedPaths.map((path) => (
            <option key={path} value={path}>
              {PATH_LABELS.get(path) || path}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          This page will be placed first in <code>allowedPaths</code> and used as the user&apos;s landing page.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const paths = section.items.map((i) => i.path);
        const allSelected = paths.every((p) => selectedSet.has(p));
        const someSelected = !allSelected && paths.some((p) => selectedSet.has(p));
        return (
          <div key={section.label} className="rounded border border-stroke p-2 dark:border-strokedark">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={() => toggleSection(paths)}
                />
                {section.label}
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {section.items.map((item) => (
                <label key={item.path} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.path)}
                    onChange={() => toggle(item.path)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PermissionSelector;
