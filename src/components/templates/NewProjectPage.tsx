"use client";

import { useEffect, useMemo, useState } from "react";
import FmsTemplateNav from "./FmsTemplateNav";
import type { FmsTask, FmsTemplate } from "./fmsTemplateTypes";

const EMPTY_SPACE_KEY = "__EMPTY_SPACE__";

type TemplateListResponse = {
  templates: FmsTemplate[];
  latestTemplate: FmsTemplate | null;
};

type TemplateDetailsResponse = {
  template: FmsTemplate;
  tasks: FmsTask[];
};

type UserOption = {
  _id: string;
  firstName?: string;
  lastName?: string;
  username: string;
  email?: string;
  isActive?: boolean;
};

type UsersResponse = {
  users: UserOption[];
};

type SpaceOption = {
  key: string;
  label: string;
  taskCount: number;
};

function normalizeSpaceKey(value: string) {
  const normalized = String(value || "").trim();
  return normalized || EMPTY_SPACE_KEY;
}

function getSpaceLabel(value: string) {
  return String(value || "").trim() || "Unassigned Space";
}

function getUserLabel(user: UserOption) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return `${fullName} (${user.username})`;
  }
  return user.username;
}

export default function NewProjectPage() {
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateTasks, setTemplateTasks] = useState<FmsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    startDate: "",
    startDateUndecided: true,
  });
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError("");

        const [templatesResponse, usersResponse] = await Promise.all([
          fetch("/api/templates/fms", { cache: "no-store" }),
          fetch("/api/users?limit=500&sortBy=firstName&sortOrder=asc", { cache: "no-store" }),
        ]);

        const templatesData: TemplateListResponse | { error: string } = await templatesResponse.json();
        const usersData: UsersResponse | { error: string } = await usersResponse.json();

        if (!templatesResponse.ok || "error" in templatesData) {
          throw new Error("error" in templatesData ? templatesData.error : "Failed to load templates");
        }

        if (!usersResponse.ok || "error" in usersData) {
          throw new Error("error" in usersData ? usersData.error : "Failed to load users");
        }

        setTemplates(templatesData.templates || []);
        setUsers((usersData.users || []).filter((user) => user.isActive !== false));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load project setup data");
      } finally {
        setLoading(false);
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateTasks([]);
      setRoleAssignments({});
      setSelectedSpaces([]);
      return;
    }

    const loadTemplate = async () => {
      try {
        setTemplateLoading(true);
        setError("");
        const response = await fetch(`/api/templates/fms/${selectedTemplateId}`, {
          cache: "no-store",
        });
        const data: TemplateDetailsResponse | { error: string } = await response.json();

        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load template details");
        }

        const nextTasks = Array.isArray(data.tasks) ? data.tasks : [];
        setTemplateTasks(nextTasks);

        const nextRoles = Array.from(
          new Set(nextTasks.map((task) => String(task.ownerCode || "").trim().toUpperCase()).filter(Boolean))
        ).sort();
        setRoleAssignments((current) =>
          Object.fromEntries(nextRoles.map((ownerCode) => [ownerCode, current[ownerCode] || ""]))
        );

        const nextSpaces = Array.from(
          new Map(
            nextTasks.map((task) => {
              const key = normalizeSpaceKey(task.spacesName);
              return [key, key];
            })
          ).keys()
        );
        setSelectedSpaces(nextSpaces);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load template details");
      } finally {
        setTemplateLoading(false);
      }
    };

    void loadTemplate();
  }, [selectedTemplateId]);

  const templateRoles = useMemo(
    () =>
      Array.from(
        new Set(templateTasks.map((task) => String(task.ownerCode || "").trim().toUpperCase()).filter(Boolean))
      ).sort(),
    [templateTasks]
  );

  const spaces = useMemo<SpaceOption[]>(() => {
    const counts = new Map<string, SpaceOption>();
    templateTasks.forEach((task) => {
      const key = normalizeSpaceKey(task.spacesName);
      const current = counts.get(key);
      if (current) {
        current.taskCount += 1;
      } else {
        counts.set(key, {
          key,
          label: getSpaceLabel(task.spacesName),
          taskCount: 1,
        });
      }
    });
    return Array.from(counts.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [templateTasks]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template._id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const selectedSpaceSet = useMemo(() => new Set(selectedSpaces), [selectedSpaces]);

  const selectedTaskCount = useMemo(() => {
    if (!templateTasks.length) {
      return 0;
    }

    return templateTasks.filter((task) => selectedSpaceSet.has(normalizeSpaceKey(task.spacesName))).length;
  }, [selectedSpaceSet, templateTasks]);

  const toggleSpace = (spaceKey: string) => {
    setSelectedSpaces((current) =>
      current.includes(spaceKey)
        ? current.filter((key) => key !== spaceKey)
        : [...current, spaceKey]
    );
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!selectedTemplateId) {
      setError("Select a template");
      return;
    }

    if (!selectedSpaces.length) {
      setError("Select at least one space");
      return;
    }

    const missingRoleAssignments = templateRoles.filter((ownerCode) => !roleAssignments[ownerCode]);
    if (missingRoleAssignments.length) {
      setError(`Assign a user for every role. Missing: ${missingRoleAssignments.join(", ")}`);
      return;
    }

    try {
      setCreating(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          templateId: selectedTemplateId,
          roleAssignments: templateRoles.map((ownerCode) => ({
            ownerCode,
            userId: roleAssignments[ownerCode],
          })),
          selectedSpaces,
          startDate: formData.startDate,
          startDateUndecided: formData.startDateUndecided,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      setMessage(
        `Created ${data.project.name} with ${data.project.totalTasks} task${data.project.totalTasks === 1 ? "" : "s"}.`
      );
      setFormData({
        name: "",
        description: "",
        address: "",
        startDate: "",
        startDateUndecided: true,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">New Project</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create a project from an FMS template, assign owners by role, and keep only the spaces you want to execute.
        </p>
      </div>

      <FmsTemplateNav />

      <form onSubmit={handleCreateProject} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Project Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Tranceed Residency - Tower A"
                />
              </label>

              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Description</span>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Short project scope or execution notes"
                />
              </label>

              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Address</span>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Site address"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Template</span>
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                {selectedTemplate ? (
                  <>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedTemplate.name}</div>
                    <div className="mt-1">{selectedTemplate.totalTasks} template tasks available</div>
                  </>
                ) : (
                  "Choose a template to load roles and spaces."
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.startDateUndecided}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        startDateUndecided: event.target.checked,
                        startDate: event.target.checked ? "" : current.startDate,
                      }))
                    }
                  />
                  Start date not decided yet
                </label>
              </div>

              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Project Start Date</span>
                <input
                  type="date"
                  value={formData.startDate}
                  disabled={formData.startDateUndecided}
                  onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Role Assignment</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Every owner code used in the selected template must be mapped to a user.
                </p>
              </div>
            </div>

            {templateLoading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading template roles...</p>
            ) : !selectedTemplateId ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Select a template to assign users.</p>
            ) : templateRoles.length ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {templateRoles.map((ownerCode) => (
                  <label key={ownerCode} className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">{ownerCode}</span>
                    <select
                      value={roleAssignments[ownerCode] || ""}
                      onChange={(event) =>
                        setRoleAssignments((current) => ({
                          ...current,
                          [ownerCode]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Assign user</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>
                          {getUserLabel(user)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">This template does not contain owner roles.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spaces</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Choose which grouped spaces should be included in the project.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSpaces(spaces.map((space) => space.key))}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSpaces([])}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {templateLoading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading spaces...</p>
            ) : !selectedTemplateId ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Select a template to view spaces.</p>
            ) : spaces.length ? (
              <div className="mt-5 grid gap-3">
                {spaces.map((space) => {
                  const isSelected = selectedSpaceSet.has(space.key);
                  return (
                    <label
                      key={space.key}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border px-4 py-4 transition ${
                        isSelected
                          ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-transparent"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{space.label}</div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {space.taskCount} task{space.taskCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSpace(space.key)}
                        className="mt-1"
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No spaces found in the selected template.</p>
            )}
          </div>

          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span>Template</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedTemplate?.name || "Not selected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Roles to assign</span>
                <span className="font-medium text-gray-900 dark:text-white">{templateRoles.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Selected spaces</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedSpaces.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tasks to create</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedTaskCount}</span>
              </div>
            </div>

            {message ? (
              <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
            ) : null}
            {error ? (
              <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={creating || loading || templateLoading}
              className="mt-5 w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Creating Project..." : "Create Project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
