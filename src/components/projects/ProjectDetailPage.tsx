"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProjectTaskTable from "./ProjectTaskTable";
import ProjectTaskFlow from "./ProjectTaskFlow";
import type { FmsTask, FmsTemplate } from "@/components/templates/fmsTemplateTypes";

type Project = {
  _id: string;
  name: string;
  description?: string;
  address?: string;
  templateName?: string;
  totalTasks?: number;
  startDate?: string | null;
  startDateUndecided?: boolean;
  active_task?: Array<{
    _id: string;
    title?: string;
    taskNumber?: string;
    processes?: string;
    spacesName?: string;
    assigneeName?: string;
  }>;
};

type ProjectResponse = {
  project: Project;
  template: Pick<FmsTemplate, "_id" | "name" | "headerRow1" | "headerRow2" | "totalTasks"> | null;
  tasks: FmsTask[];
};

export default function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<"table" | "flow">("table");
  const [project, setProject] = useState<Project | null>(null);
  const [template, setTemplate] = useState<ProjectResponse["template"]>(null);
  const [allTasks, setAllTasks] = useState<FmsTask[]>([]);
  const [page, setPage] = useState(1);
  const [flowPageSize, setFlowPageSize] = useState(150);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [tab, projectId]);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        const data: ProjectResponse | { error: string } = await response.json();
        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load project");
        }

        setProject(data.project);
        setTemplate(data.template);
        setAllTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    void loadProject();
  }, [projectId]);

  const applyTasksSnapshot = (nextTasks: FmsTask[]) => {
    setAllTasks(nextTasks);
    setProject((currentProject) =>
      currentProject
        ? {
            ...currentProject,
            totalTasks: nextTasks.length,
          }
        : currentProject
    );
  };

  const pagination = useMemo(() => {
    const totalTasks = allTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasks / flowPageSize));
    const safePage = Math.min(page, totalPages);

    return {
      currentPage: safePage,
      totalPages,
      totalTasks,
      limit: flowPageSize,
    };
  }, [allTasks.length, flowPageSize, page]);

  const tasks = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.limit;
    const end = start + pagination.limit;
    return allTasks.slice(start, end);
  }, [allTasks, pagination]);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/Templates/projects" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Back to Projects
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {project?.name || "Project Details"}
          </h1>
          {project ? (
            <div className="mt-2 grid gap-1 text-sm text-gray-600 dark:text-gray-300">
              <div>Template: {project.templateName || template?.name || "-"}</div>
              <div>
                Start Date:{" "}
                {project.startDateUndecided || !project.startDate
                  ? "Not decided"
                  : new Date(project.startDate).toLocaleDateString()}
              </div>
              {project.address ? <div>Address: {project.address}</div> : null}
              {project.description ? <div>Description: {project.description}</div> : null}
            </div>
          ) : null}
          {project?.active_task?.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Active Tasks</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.active_task.map((task) => (
                  <div
                    key={task._id}
                    className="rounded-xl bg-white px-3 py-2 text-xs text-amber-900 shadow-sm ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800"
                  >
                    <div className="font-semibold">{task.taskNumber ? `#${task.taskNumber}` : "Task"}</div>
                    <div>{task.title || task.processes || "Untitled task"}</div>
                    {task.assigneeName ? <div className="mt-1 opacity-80">{task.assigneeName}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("table")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === "table"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setTab("flow")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === "flow"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              Flow
            </button>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.totalTasks} project tasks
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading project view...</p>
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : tab === "table" ? (
          <ProjectTaskTable
            projectId={projectId}
            template={template}
            tasks={allTasks}
            onTaskUpdated={(updatedTask) => {
              setAllTasks((currentTasks) =>
                currentTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task))
              );
            }}
            onTaskDeleted={(taskId) => {
              setAllTasks((currentTasks) => currentTasks.filter((task) => task._id !== taskId));
              setProject((currentProject) =>
                currentProject
                  ? {
                      ...currentProject,
                      totalTasks: Math.max(0, (currentProject.totalTasks ?? allTasks.length) - 1),
                    }
                  : currentProject
              );
            }}
            onTasksChanged={applyTasksSnapshot}
          />
        ) : (
          <ProjectTaskFlow
            projectId={projectId}
            tasks={tasks}
            pagination={pagination}
            pageSize={flowPageSize}
            onPageSizeChange={(nextPageSize) => {
              setFlowPageSize(nextPageSize);
              setPage(1);
            }}
            onPageChange={(nextPage) => {
              if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === page) {
                return;
              }
              setPage(nextPage);
            }}
            onTaskUpdated={(updatedTask) => {
              setAllTasks((currentTasks) =>
                currentTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task))
              );
            }}
            onTasksChanged={applyTasksSnapshot}
          />
        )}
      </div>
    </div>
  );
}
