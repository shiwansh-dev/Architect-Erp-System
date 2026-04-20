"use client";

import { useEffect, useState } from "react";

type Project = {
  _id: string;
  name: string;
  templateName?: string;
  totalTasks?: number;
  startDate?: string | null;
  startDateUndecided?: boolean;
  deleteApprovalRequestedAt?: string | null;
};

function formatStartDate(project: Project) {
  if (project.startDateUndecided || !project.startDate) {
    return "Not decided";
  }

  return new Date(project.startDate).toLocaleDateString();
}

export default function ProjectDeleteApprovalPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/projects?status=pending-delete", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load projects awaiting approval");
      }

      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load projects awaiting approval");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const handleApprovalAction = async (projectId: string, action: "restore" | "approve-delete") => {
    const confirmMessage =
      action === "approve-delete"
        ? "Delete this project permanently? This cannot be undone."
        : "Restore this project back to the active list?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setError("");
      setMessage("");
      const response = await fetch(`/api/projects/${projectId}/approval`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to process approval action");
      }

      setProjects((current) => current.filter((project) => project._id !== projectId));
      setMessage(data.message || "Approval action completed.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to process approval action");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Project Delete Approval</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Projects requested for deletion stay here until someone restores them or deletes them permanently.
        </p>
      </div>
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        {message ? <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading approval queue...</p>
        ) : projects.length ? (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{project.name}</h2>
                    <div className="mt-2 grid gap-1 text-sm text-gray-600 dark:text-gray-300">
                      <div>Template: {project.templateName || "-"}</div>
                      <div>Start Date: {formatStartDate(project)}</div>
                      <div>Tasks: {project.totalTasks || 0}</div>
                      <div>
                        Delete Requested:{" "}
                        {project.deleteApprovalRequestedAt
                          ? new Date(project.deleteApprovalRequestedAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprovalAction(project._id, "restore")}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovalAction(project._id, "approve-delete")}
                      className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white"
                    >
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No projects are waiting for delete approval.</p>
        )}
      </div>
    </div>
  );
}
