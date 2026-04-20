"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Project = {
  _id: string;
  name: string;
  description?: string;
  address?: string;
  templateName?: string;
  totalTasks?: number;
  startDate?: string | null;
  startDateUndecided?: boolean;
  updatedAt?: string;
  deleteApprovalRequestedAt?: string | null;
  active_task?: Array<{
    _id: string;
    title?: string;
    taskNumber?: string;
    assigneeName?: string;
  }>;
};

const emptyForm = {
  name: "",
  description: "",
  address: "",
  startDate: "",
  startDateUndecided: true,
};

function formatStartDate(project: Project) {
  if (project.startDateUndecided || !project.startDate) {
    return "Not decided";
  }

  return new Date(project.startDate).toLocaleDateString();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load projects");
      }

      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name || "",
      description: project.description || "",
      address: project.address || "",
      startDate:
        project.startDate && !project.startDateUndecided
          ? new Date(project.startDate).toISOString().slice(0, 10)
          : "",
      startDateUndecided: project.startDateUndecided !== false,
    });
  };

  const handleUpdateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProject) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/projects/${editingProject._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update project");
      }

      setProjects((current) =>
        current.map((project) => (project._id === editingProject._id ? data.project : project))
      );
      setMessage("Project updated successfully.");
      setEditingProject(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async (project: Project) => {
    const confirmed = window.confirm(`Move ${project.name} to delete approval?`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`/api/projects/${project._id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to request deletion");
      }

      setProjects((current) => current.filter((item) => item._id !== project._id));
      setMessage(`${project.name} moved to delete approval.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to request deletion");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Projects</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Review live projects, update their metadata, open their task views, or send them for delete approval.
        </p>
      </div>
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{projects.length} active project(s)</p>
          </div>
          <Link
            href="/Templates/new-project"
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Create Project
          </Link>
        </div>

        {message ? <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading projects...</p>
        ) : projects.length ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Project</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Template</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Start Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Tasks</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Active Tasks</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Updated</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project._id} className="border-t border-gray-200 align-top dark:border-gray-800">
                    <td className="px-4 py-4">
                      <Link
                        href={`/Templates/projects/${project._id}`}
                        className="font-semibold text-gray-900 underline-offset-2 hover:underline dark:text-white"
                      >
                        {project.name}
                      </Link>
                      {project.description ? (
                        <div className="mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">{project.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{project.templateName || "-"}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{formatStartDate(project)}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{project.totalTasks || 0}</td>
                    <td className="px-4 py-4">
                      {project.active_task?.length ? (
                        <div className="flex max-w-sm flex-wrap gap-2">
                          {project.active_task.slice(0, 3).map((task) => (
                            <span
                              key={task._id}
                              className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900"
                            >
                              {task.taskNumber ? `#${task.taskNumber}` : task.title || "Task"}
                            </span>
                          ))}
                          {project.active_task.length > 3 ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              +{project.active_task.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(project)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(project)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No projects created yet.</p>
        )}
      </div>

      <Modal
        isOpen={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        className="m-4 max-w-2xl"
      >
        {editingProject ? (
          <div className="rounded-3xl bg-white p-6 dark:bg-gray-900">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Project</h3>
            <form onSubmit={handleUpdateProject} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Project Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Description</span>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Address</span>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

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

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Project Start Date</span>
                <input
                  type="date"
                  value={formData.startDate}
                  disabled={formData.startDateUndecided}
                  onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
