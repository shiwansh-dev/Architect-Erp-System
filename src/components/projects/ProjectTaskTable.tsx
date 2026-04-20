"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Pagination from "@/components/tables/Pagination";
import type { FmsTask, FmsTemplate } from "@/components/templates/fmsTemplateTypes";
import { DEFAULT_FMS_SECONDARY_HEADERS } from "@/lib/fms-table-headers";

const HOW_WILL_IT_BE_DONE_LABEL = "HOW will it be done";
const ALLOTTED_DAYS_COLUMN_INDEX = 19;
const TASK_LINK_COLUMN_INDEX = 21;

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function buildBulkPatch(fields: Record<string, string>) {
  return Object.entries(fields).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const normalizedValue = String(value || "");
    if (normalizedValue.trim()) {
      accumulator[key] = normalizedValue;
    }
    return accumulator;
  }, {});
}

export default function ProjectTaskTable({
  projectId,
  template,
  tasks,
  onTaskUpdated,
  onTaskDeleted,
  onTasksChanged,
}: {
  projectId: string;
  template: Pick<FmsTemplate, "headerRow1" | "headerRow2"> | null;
  tasks: FmsTask[];
  onTaskUpdated: (task: FmsTask) => void;
  onTaskDeleted: (taskId: string) => void;
  onTasksChanged: (tasks: FmsTask[]) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<FmsTask | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkFields, setBulkFields] = useState<Record<string, string>>({
    title: "",
    taskNumber: "",
    mainHeading: "",
    subHeading: "",
    processes: "",
    parallelSteps: "",
    ownerCode: "",
    assigneeName: "",
    howWillItBeDone: "",
    allottedDays: "",
    status: "",
    delegationDate: "",
    changedDelegationDate: "",
    secondaryDelegationDate: "",
    drawingNumber: "",
    dueRule: "",
    relationshipType: "",
    taskLink: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const headerRow1 = useMemo(
    () => (template ? ["Select", ...template.headerRow1, ""] : []),
    [template]
  );
  const headerRow2 = useMemo(
    () =>
      template
        ? [
            "Select",
            ...template.headerRow2.map((cell, index) => cell || DEFAULT_FMS_SECONDARY_HEADERS[index] || `COLUMN ${index + 1}`),
            HOW_WILL_IT_BE_DONE_LABEL,
          ]
        : [],
    [template]
  );
  const totalColumns = headerRow2.length;

  useEffect(() => {
    setSearchTerms((current) => {
      if (current.length === totalColumns) {
        return current;
      }
      return Array.from({ length: totalColumns }, (_, index) => current[index] || "");
    });
  }, [totalColumns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tasks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    setSelectedTaskIds((current) =>
      current.filter((taskId) => tasks.some((task) => task._id === taskId))
    );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const row = ["", ...(task.rawCells || []), task.howWillItBeDone || ""];
      return searchTerms.every((term, index) => {
        const normalizedTerm = String(term || "").trim().toLowerCase();
        if (!normalizedTerm) {
          return true;
        }
        return String(row[index] || "").toLowerCase().includes(normalizedTerm);
      });
    });
  }, [searchTerms, tasks]);

  const pagination = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize));
    const safePage = Math.min(currentPage, totalPages);

    return {
      currentPage: safePage,
      totalPages,
      totalTasks,
      limit: pageSize,
    };
  }, [currentPage, filteredTasks.length, pageSize]);

  const visibleTasks = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.limit;
    return filteredTasks.slice(start, start + pagination.limit);
  }, [filteredTasks, pagination]);

  const selectedCount = selectedTaskIds.length;
  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.includes(task._id));

  const handleTaskSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/projects/${projectId}/tasks/${editingTask._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTask),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update task");
      }

      onTaskUpdated(data.task);
      setEditingTask(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const handleTaskDelete = async () => {
    if (!editingTask) {
      return;
    }

    const confirmed = window.confirm(`Delete task ${editingTask.taskNumber || editingTask.rowNumber}?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      const response = await fetch(`/api/projects/${projectId}/tasks/${editingTask._id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete task");
      }

      onTaskDeleted(editingTask._id);
      setEditingTask(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedTaskIds.length) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedTaskIds.length} selected tasks?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      const response = await fetch(`/api/projects/${projectId}/tasks/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: selectedTaskIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete tasks");
      }

      onTasksChanged(Array.isArray(data.tasks) ? data.tasks : []);
      setSelectedTaskIds([]);
      setSelectionMode(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete tasks");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkStateUpdate = async (action: "mark_done" | "mark_undone") => {
    if (!selectedTaskIds.length) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/projects/${projectId}/tasks/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          action,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update task state");
      }

      onTasksChanged(Array.isArray(data.tasks) ? data.tasks : []);
      setSelectedTaskIds([]);
      setSelectionMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task state");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTaskIds.length) {
      return;
    }

    const patch = buildBulkPatch(bulkFields);
    if (!Object.keys(patch).length) {
      setError("Enter at least one field to update");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/projects/${projectId}/tasks/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          patch,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update tasks");
      }

      onTasksChanged(Array.isArray(data.tasks) ? data.tasks : []);
      setBulkEditing(false);
      setSelectionMode(false);
      setSelectedTaskIds([]);
      setBulkFields({
        title: "",
        taskNumber: "",
        mainHeading: "",
        subHeading: "",
        processes: "",
        parallelSteps: "",
        ownerCode: "",
        assigneeName: "",
        howWillItBeDone: "",
        allottedDays: "",
        status: "",
        delegationDate: "",
        changedDelegationDate: "",
        secondaryDelegationDate: "",
        drawingNumber: "",
        dueRule: "",
        relationshipType: "",
        taskLink: "",
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update tasks");
    } finally {
      setSaving(false);
    }
  };

  const paginationControls = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Tasks per page</span>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value) || 100)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {[50, 100, 150, 200, 300].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={(page) => {
          if (page < 1 || page > pagination.totalPages || page === pagination.currentPage) {
            return;
          }
          setCurrentPage(page);
        }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredTasks.length ? (pagination.currentPage - 1) * pagination.limit + 1 : 0}-
          {Math.min(pagination.currentPage * pagination.limit, pagination.totalTasks)} of {pagination.totalTasks} rows
        </p>
        {paginationControls}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setSelectionMode((current) => !current);
            setSelectedTaskIds([]);
          }}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            selectionMode
              ? "bg-gray-900 text-white"
              : "border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200"
          }`}
        >
          {selectionMode ? "Cancel Selection" : "Select"}
        </button>
        {selectionMode ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedCount} selected</span>
            <button
              type="button"
              onClick={() => setBulkEditing(true)}
              disabled={!selectedCount}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStateUpdate("mark_done")}
              disabled={!selectedCount || saving}
              className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
            >
              Mark Done
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStateUpdate("mark_undone")}
              disabled={!selectedCount || saving}
              className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 disabled:opacity-50"
            >
              Mark Undone
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={!selectedCount || deleting}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="min-w-[2140px] w-full border-collapse text-left text-xs">
          {template ? (
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/60">
                {headerRow2.map((_, index) => (
                  <th
                    key={`search-${index}`}
                    className="border border-gray-200 px-2 py-2 dark:border-gray-800"
                  >
                    {index === 0 ? null : (
                      <input
                        value={searchTerms[index] || ""}
                        onChange={(event) =>
                          setSearchTerms((current) =>
                            current.map((term, termIndex) =>
                              termIndex === index ? event.target.value : term
                            )
                          )
                        }
                        placeholder="Search..."
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-normal text-gray-700 outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                    )}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-900">
                {headerRow1.map((cell, index) => (
                  <th
                    key={`h1-${index}`}
                    className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 dark:border-gray-800 dark:text-gray-200"
                  >
                    {cell || "\u00A0"}
                  </th>
                ))}
              </tr>
              <tr className="bg-white dark:bg-gray-950">
                {headerRow2.map((cell, index) => (
                  <th
                    key={`h2-${index}`}
                    className="border border-gray-200 px-3 py-2 font-medium text-gray-600 dark:border-gray-800 dark:text-gray-300"
                  >
                    {cell || "\u00A0"}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {visibleTasks.map((task, rowIndex) => {
              const row = [...(task.rawCells || []), task.howWillItBeDone || ""];
              return (
                <tr
                  key={task._id}
                  onClick={() => {
                    setError("");
                    if (selectionMode) {
                      toggleTaskSelection(task._id);
                      return;
                    }
                    setEditingTask(task);
                  }}
                  className={`align-top hover:bg-gray-100/70 dark:hover:bg-gray-800/60 ${
                    task.isDone
                      ? "bg-emerald-50/80 dark:bg-emerald-950/30"
                      : task.isActive
                        ? "bg-amber-50/80 dark:bg-amber-950/30"
                        : rowIndex % 2 === 0
                          ? "bg-white dark:bg-gray-950"
                          : "bg-gray-50/60 dark:bg-gray-900/40"
                  }`}
                >
                  <td className="border border-gray-200 px-3 py-2 text-center dark:border-gray-800">
                    <input
                      type="checkbox"
                      disabled={!selectionMode}
                      checked={selectedTaskIds.includes(task._id)}
                      onChange={() => toggleTaskSelection(task._id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className={`max-w-[240px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] border px-3 py-2 text-gray-700 dark:text-gray-300 ${
                        cellIndex === ALLOTTED_DAYS_COLUMN_INDEX
                          ? "border-emerald-200 bg-emerald-50/70 font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      {cellIndex === TASK_LINK_COLUMN_INDEX && isHttpUrl(cell) ? (
                        <a
                          href={cell}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-blue-600 underline break-words [overflow-wrap:anywhere] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {cell}
                        </a>
                      ) : (
                        cell || "\u00A0"
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">{paginationControls}</div>

      {selectionMode && visibleTasks.length ? (
        <div className="flex justify-start">
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                if (event.target.checked) {
                  setSelectedTaskIds((current) =>
                    Array.from(new Set([...current, ...visibleTasks.map((task) => task._id)]))
                  );
                } else {
                  setSelectedTaskIds((current) =>
                    current.filter((taskId) => !visibleTasks.some((task) => task._id === taskId))
                  );
                }
              }}
            />
            Select all tasks on this page
          </label>
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        className="m-4 max-h-[calc(100vh-2rem)] max-w-[860px] overflow-hidden"
      >
        {editingTask ? (
          <div className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-3xl bg-white dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800 lg:px-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Task</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Update or delete this project task from table view.
              </p>
            </div>

            <form onSubmit={handleTaskSave} className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Title</span>
                    <input value={editingTask.title} onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Number</span>
                    <input value={editingTask.taskNumber} onChange={(event) => setEditingTask({ ...editingTask, taskNumber: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Main Heading</span>
                    <input value={editingTask.mainHeading} onChange={(event) => setEditingTask({ ...editingTask, mainHeading: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Sub Heading</span>
                    <input value={editingTask.subHeading} onChange={(event) => setEditingTask({ ...editingTask, subHeading: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Processes</span>
                    <textarea rows={3} value={editingTask.processes} onChange={(event) => setEditingTask({ ...editingTask, processes: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Parallel Steps / Task Details</span>
                    <textarea rows={3} value={editingTask.parallelSteps} onChange={(event) => setEditingTask({ ...editingTask, parallelSteps: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Owner Code</span>
                    <input value={editingTask.ownerCode} onChange={(event) => setEditingTask({ ...editingTask, ownerCode: event.target.value.toUpperCase() })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">WHO will do it (NAME)</span>
                    <input value={editingTask.assigneeName} onChange={(event) => setEditingTask({ ...editingTask, assigneeName: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">HOW will it be done</span>
                    <textarea rows={3} value={editingTask.howWillItBeDone || ""} onChange={(event) => setEditingTask({ ...editingTask, howWillItBeDone: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Allotted Days</span>
                    <input type="number" min="0" value={editingTask.allottedDays} onChange={(event) => setEditingTask({ ...editingTask, allottedDays: event.target.value || "1" })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">STATUS</span>
                    <input value={editingTask.status} onChange={(event) => setEditingTask({ ...editingTask, status: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE</span>
                    <input value={editingTask.delegationDate} onChange={(event) => setEditingTask({ ...editingTask, delegationDate: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">CHANGED DELEGATION DATE</span>
                    <input value={editingTask.changedDelegationDate} onChange={(event) => setEditingTask({ ...editingTask, changedDelegationDate: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE 2</span>
                    <input value={editingTask.secondaryDelegationDate} onChange={(event) => setEditingTask({ ...editingTask, secondaryDelegationDate: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DWG. NO.</span>
                    <input value={editingTask.drawingNumber} onChange={(event) => setEditingTask({ ...editingTask, drawingNumber: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Due Rule</span>
                    <input value={editingTask.dueRule} onChange={(event) => setEditingTask({ ...editingTask, dueRule: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Relationship</span>
                    <select value={editingTask.relationshipType} onChange={(event) => setEditingTask({ ...editingTask, relationshipType: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                      <option value="root">Root</option>
                      <option value="sequential">Sequential</option>
                      <option value="parallel">Parallel</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Link</span>
                    <input value={editingTask.taskLink} onChange={(event) => setEditingTask({ ...editingTask, taskLink: event.target.value })} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                  </label>
                </div>

                <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => void handleTaskDelete()}
                    disabled={deleting}
                    className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Task"}
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingTask(null)}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Task"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={bulkEditing}
        onClose={() => setBulkEditing(false)}
        className="m-4 max-h-[calc(100vh-2rem)] max-w-[860px] overflow-hidden"
      >
        <div className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-3xl bg-white dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-800 lg:px-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Bulk Edit Tasks</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Only fields you type will be updated across {selectedCount} selected tasks.
            </p>
          </div>

          <form onSubmit={handleBulkSave} className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Title</span>
                <input value={bulkFields.title} onChange={(event) => setBulkFields((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Number</span>
                <input value={bulkFields.taskNumber} onChange={(event) => setBulkFields((current) => ({ ...current, taskNumber: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Main Heading</span>
                <input value={bulkFields.mainHeading} onChange={(event) => setBulkFields((current) => ({ ...current, mainHeading: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Sub Heading</span>
                <input value={bulkFields.subHeading} onChange={(event) => setBulkFields((current) => ({ ...current, subHeading: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Processes</span>
                <textarea rows={3} value={bulkFields.processes} onChange={(event) => setBulkFields((current) => ({ ...current, processes: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Parallel Steps / Task Details</span>
                <textarea rows={3} value={bulkFields.parallelSteps} onChange={(event) => setBulkFields((current) => ({ ...current, parallelSteps: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Owner Code</span>
                <input value={bulkFields.ownerCode} onChange={(event) => setBulkFields((current) => ({ ...current, ownerCode: event.target.value.toUpperCase() }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">WHO will do it (NAME)</span>
                <input value={bulkFields.assigneeName} onChange={(event) => setBulkFields((current) => ({ ...current, assigneeName: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">HOW will it be done</span>
                <textarea rows={3} value={bulkFields.howWillItBeDone} onChange={(event) => setBulkFields((current) => ({ ...current, howWillItBeDone: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Allotted Days</span>
                <input type="number" min="0" value={bulkFields.allottedDays} onChange={(event) => setBulkFields((current) => ({ ...current, allottedDays: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">STATUS</span>
                <input value={bulkFields.status} onChange={(event) => setBulkFields((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE</span>
                <input value={bulkFields.delegationDate} onChange={(event) => setBulkFields((current) => ({ ...current, delegationDate: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">CHANGED DELEGATION DATE</span>
                <input value={bulkFields.changedDelegationDate} onChange={(event) => setBulkFields((current) => ({ ...current, changedDelegationDate: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE 2</span>
                <input value={bulkFields.secondaryDelegationDate} onChange={(event) => setBulkFields((current) => ({ ...current, secondaryDelegationDate: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DWG. NO.</span>
                <input value={bulkFields.drawingNumber} onChange={(event) => setBulkFields((current) => ({ ...current, drawingNumber: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Due Rule</span>
                <input value={bulkFields.dueRule} onChange={(event) => setBulkFields((current) => ({ ...current, dueRule: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Relationship</span>
                <select value={bulkFields.relationshipType} onChange={(event) => setBulkFields((current) => ({ ...current, relationshipType: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="">No change</option>
                  <option value="root">Root</option>
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Link</span>
                <input value={bulkFields.taskLink} onChange={(event) => setBulkFields((current) => ({ ...current, taskLink: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setBulkEditing(false)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
