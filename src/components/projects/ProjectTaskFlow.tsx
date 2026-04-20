"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Pagination from "@/components/tables/Pagination";
import type { FmsTask } from "@/components/templates/fmsTemplateTypes";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 132;

function getTaskPosition(task: FmsTask) {
  return {
    x: task.position?.x ?? 80,
    y: task.position?.y ?? 80,
    width: task.position?.width || NODE_WIDTH,
    height: task.position?.height || NODE_HEIGHT,
  };
}

function getEdgePath(source: FmsTask, target: FmsTask) {
  const sourcePosition = getTaskPosition(source);
  const targetPosition = getTaskPosition(target);
  const sourceX = sourcePosition.x + sourcePosition.width / 2;
  const sourceY = sourcePosition.y + sourcePosition.height;
  const targetX = targetPosition.x + targetPosition.width / 2;
  const targetY = targetPosition.y;
  const curve = Math.max(80, Math.abs(targetY - sourceY) / 2);

  return `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + curve}, ${targetX} ${targetY - curve}, ${targetX} ${targetY}`;
}

function buildTitle(task: FmsTask) {
  return task.title || [task.taskNumber ? `#${task.taskNumber}` : "", task.processes || task.parallelSteps || task.taskDescription].filter(Boolean).join(" ");
}

function formatAllottedDaysLabel(value: string) {
  const normalized = String(value || "").trim() || "1";
  return `${normalized} day${normalized === "1" ? "" : "s"}`;
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

function hasUsableSavedPosition(task: FmsTask) {
  return (
    typeof task.position?.x === "number" &&
    Number.isFinite(task.position.x) &&
    typeof task.position?.y === "number" &&
    Number.isFinite(task.position.y)
  );
}

function normalizeTaskPositions(tasks: FmsTask[]) {
  return tasks.map((task) => ({
    ...task,
    position: getTaskPosition(task),
  }));
}

function layoutTasksVertically(tasks: FmsTask[]) {
  const byId = new Map(tasks.map((task) => [task._id, task]));
  const childrenByParent = new Map<string, FmsTask[]>();
  const roots: FmsTask[] = [];

  tasks.forEach((task) => {
    if (!task.dependsOnTaskIds.length) {
      roots.push(task);
      return;
    }

    task.dependsOnTaskIds.forEach((parentId) => {
      const siblings = childrenByParent.get(parentId) || [];
      siblings.push(task);
      childrenByParent.set(parentId, siblings);
    });
  });

  const positioned = new Map<string, FmsTask>();
  const visited = new Set<string>();
  const placeFromSeeds = (seedTasks: FmsTask[], startRowOffset = 0) => {
    const stack: Array<{ task: FmsTask; column: number; row: number }> = seedTasks
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map((task, index) => ({
        task,
        column: 0,
        row: startRowOffset + index,
      }))
      .reverse();

    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current.task._id)) {
        continue;
      }

      visited.add(current.task._id);
      const savedPosition = hasUsableSavedPosition(current.task) ? getTaskPosition(current.task) : null;
      positioned.set(current.task._id, {
        ...current.task,
        position: {
          ...getTaskPosition(current.task),
          x: savedPosition?.x ?? 80 + current.column * 320,
          y: savedPosition?.y ?? 80 + current.row * 220,
          width: savedPosition?.width ?? NODE_WIDTH,
          height: savedPosition?.height ?? NODE_HEIGHT,
        },
      });

      const children = (childrenByParent.get(current.task._id) || []).sort(
        (a, b) => a.rowNumber - b.rowNumber
      );
      let sequentialOffset = 1;
      const nextNodes: Array<{ task: FmsTask; column: number; row: number }> = [];

      children.forEach((child, index) => {
        if (visited.has(child._id)) {
          return;
        }

        const isParallel = child.relationshipType === "parallel";
        nextNodes.push({
          task: child,
          column: isParallel ? current.column + index : current.column,
          row: isParallel ? current.row + 1 : current.row + sequentialOffset,
        });

        if (!isParallel) {
          sequentialOffset += 1;
        }
      });

      for (let index = nextNodes.length - 1; index >= 0; index -= 1) {
        stack.push(nextNodes[index]);
      }
    }
  };

  placeFromSeeds(roots, 0);

  const unpositioned = tasks.filter((task) => !positioned.has(task._id));
  if (unpositioned.length) {
    placeFromSeeds(unpositioned, roots.length + 1);
  }

  return normalizeTaskPositions(tasks.map((task) => positioned.get(task._id) || byId.get(task._id) || task));
}

export default function ProjectTaskFlow({
  projectId,
  tasks,
  pagination,
  pageSize,
  onPageSizeChange,
  onPageChange,
  onTaskUpdated,
  onTasksChanged,
}: {
  projectId: string;
  tasks: FmsTask[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalTasks: number;
    limit: number;
  } | null;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  onPageChange: (page: number) => void;
  onTaskUpdated: (task: FmsTask) => void;
  onTasksChanged: (tasks: FmsTask[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const tasksRef = useRef<FmsTask[]>([]);
  const [localTasks, setLocalTasks] = useState<FmsTask[]>([]);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [editingTask, setEditingTask] = useState<FmsTask | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<{
    sourceId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
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
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const nextTasks = layoutTasksVertically(tasks);
    setLocalTasks(nextTasks);
  }, [tasks]);

  useEffect(() => {
    tasksRef.current = localTasks;
  }, [localTasks]);

  useEffect(() => {
    setSelectedTaskIds((current) =>
      current.filter((taskId) => tasks.some((task) => task._id === taskId))
    );
  }, [tasks]);

  const normalizedTasks = useMemo(() => layoutTasksVertically(localTasks), [localTasks]);
  const taskMap = useMemo(() => new Map(normalizedTasks.map((task) => [task._id, task])), [normalizedTasks]);

  const visibleEdges = useMemo(() => {
    const connections: Array<{ from: FmsTask; to: FmsTask; key: string }> = [];
    normalizedTasks.forEach((task) => {
      task.dependsOnTaskIds.forEach((dependencyId) => {
        const source = taskMap.get(dependencyId);
        if (source) {
          connections.push({
            from: source,
            to: task,
            key: `${source._id}-${task._id}`,
          });
        }
      });
    });
    return connections;
  }, [normalizedTasks, taskMap]);

  const canvasSize = useMemo(() => {
    const maxX = normalizedTasks.reduce((acc, task) => Math.max(acc, getTaskPosition(task).x + getTaskPosition(task).width), 0);
    const maxY = normalizedTasks.reduce((acc, task) => Math.max(acc, getTaskPosition(task).y + getTaskPosition(task).height), 0);
    return {
      width: maxX + 160,
      height: maxY + 160,
    };
  }, [normalizedTasks]);

  const persistTaskUpdate = async (
    taskId: string,
    payload: Partial<FmsTask> & { dependsOnTaskIds?: string[]; relationshipType?: string }
  ) => {
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update task");
    }

    setLocalTasks((currentTasks) =>
      currentTasks.map((item) => (item._id === taskId ? data.task : item))
    );
    onTaskUpdated(data.task as FmsTask);
    return data.task as FmsTask;
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) {
        return;
      }

      setLocalTasks((currentTasks) =>
        currentTasks.map((task) =>
          task._id === dragging.id
            ? {
                ...task,
                position: {
                  ...getTaskPosition(task),
                  x: Math.max(24, event.clientX - canvasRect.left - dragging.offsetX),
                  y: Math.max(24, event.clientY - canvasRect.top - dragging.offsetY),
                },
              }
            : task
        )
      );
    };

    const handlePointerUp = async () => {
      const task = tasksRef.current.find((item) => item._id === dragging.id);
      setDragging(null);
      if (!task) {
        return;
      }

      try {
        await persistTaskUpdate(task._id, {
          position: task.position,
        });
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to persist node position");
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!connectionDrag) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) {
        return;
      }

      setConnectionDrag((current) =>
        current
          ? {
              ...current,
              currentX: event.clientX - canvasRect.left,
              currentY: event.clientY - canvasRect.top,
            }
          : null
      );
    };

    const handlePointerUp = () => {
      setConnectionDrag(null);
      setSaveMessage("");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [connectionDrag]);

  const startConnectionFromTask = (task: FmsTask) => {
    setSelectedEdge(null);
    const position = getTaskPosition(task);
    setConnectionDrag({
      sourceId: task._id,
      startX: position.x + position.width / 2,
      startY: position.y + position.height,
      currentX: position.x + position.width / 2,
      currentY: position.y + position.height,
    });
    setSaveMessage(`Connecting from ${buildTitle(task)}.`);
  };

  const completeConnectionToTask = async (task: FmsTask) => {
    if (!connectionDrag || connectionDrag.sourceId === task._id) {
      return;
    }

    const nextDependencies = Array.from(new Set([...(task.dependsOnTaskIds || []), connectionDrag.sourceId]));
    try {
      await persistTaskUpdate(task._id, {
        dependsOnTaskIds: nextDependencies,
        relationshipType: "manual",
      });
      setSaveMessage("Connection saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save connection");
    } finally {
      setConnectionDrag(null);
    }
  };

  const removeSelectedConnection = async () => {
    if (!selectedEdge) {
      return;
    }

    const targetTask = localTasks.find((task) => task._id === selectedEdge.targetId);
    if (!targetTask) {
      return;
    }

    const nextDependencies = (targetTask.dependsOnTaskIds || []).filter(
      (dependencyId) => dependencyId !== selectedEdge.sourceId
    );

    try {
      await persistTaskUpdate(targetTask._id, {
        dependsOnTaskIds: nextDependencies,
        relationshipType: nextDependencies.length ? targetTask.relationshipType : "root",
      });
      setSaveMessage("Connection removed.");
      setSelectedEdge(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove connection");
    }
  };

  const handleTaskSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask) {
      return;
    }

    try {
      await persistTaskUpdate(editingTask._id, editingTask);
      setEditingTask(null);
      setSaveMessage("Task updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task");
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  };

  const resetBulkEditor = () => {
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
      setBulkSaving(true);
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
      setSaveMessage("Selected tasks deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete tasks");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkStateUpdate = async (action: "mark_done" | "mark_undone") => {
    if (!selectedTaskIds.length) {
      return;
    }

    try {
      setBulkSaving(true);
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
      setSaveMessage(action === "mark_done" ? "Selected tasks marked done." : "Selected tasks marked undone.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task state");
    } finally {
      setBulkSaving(false);
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
      setBulkSaving(true);
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
      resetBulkEditor();
      setSaveMessage("Selected tasks updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update tasks");
    } finally {
      setBulkSaving(false);
    }
  };

  const selectedDependencyIds = new Set(editingTask?.dependsOnTaskIds || []);
  const paginationControls = pagination ? (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {(pagination.currentPage - 1) * pagination.limit + 1}-
        {Math.min(pagination.currentPage * pagination.limit, pagination.totalTasks)} of {pagination.totalTasks} tasks
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Tasks per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) || 150)}
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
          onPageChange={onPageChange}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {paginationControls}

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
            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedTaskIds.length} selected</span>
            <button
              type="button"
              onClick={() => setBulkEditing(true)}
              disabled={!selectedTaskIds.length}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStateUpdate("mark_done")}
              disabled={!selectedTaskIds.length || bulkSaving}
              className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
            >
              Mark Done
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStateUpdate("mark_undone")}
              disabled={!selectedTaskIds.length || bulkSaving}
              className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 disabled:opacity-50"
            >
              Mark Undone
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={!selectedTaskIds.length || bulkSaving}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              {bulkSaving ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
      </div>

      {saveMessage ? (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{saveMessage}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <svg className="absolute inset-0 h-full w-full" width={canvasSize.width} height={canvasSize.height}>
            {visibleEdges.map((edge, index) => (
              <g key={`${edge.key}-${index}`}>
                <path
                  d={getEdgePath(edge.from, edge.to)}
                  stroke="transparent"
                  strokeWidth="18"
                  fill="none"
                  strokeLinecap="round"
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onClick={() => {
                    setSelectedEdge({
                      sourceId: edge.from._id,
                      targetId: edge.to._id,
                    });
                    setConnectionDrag(null);
                    setSaveMessage(`Selected connection from ${buildTitle(edge.from)} to ${buildTitle(edge.to)}.`);
                  }}
                />
                <path
                  d={getEdgePath(edge.from, edge.to)}
                  stroke={
                    selectedEdge?.sourceId === edge.from._id && selectedEdge?.targetId === edge.to._id
                      ? "#dc2626"
                      : "#4f46e5"
                  }
                  strokeWidth={
                    selectedEdge?.sourceId === edge.from._id && selectedEdge?.targetId === edge.to._id ? "4" : "3"
                  }
                  fill="none"
                  strokeLinecap="round"
                  style={{ pointerEvents: "none" }}
                />
              </g>
            ))}
            {connectionDrag ? (
              <path
                d={`M ${connectionDrag.startX} ${connectionDrag.startY} C ${connectionDrag.startX} ${connectionDrag.startY + 80}, ${connectionDrag.currentX} ${connectionDrag.currentY - 80}, ${connectionDrag.currentX} ${connectionDrag.currentY}`}
                stroke="#10b981"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 6"
                style={{ pointerEvents: "none" }}
              />
            ) : null}
          </svg>

          {selectedEdge ? (() => {
            const edge = visibleEdges.find(
              (item) => item.from._id === selectedEdge.sourceId && item.to._id === selectedEdge.targetId
            );
            if (!edge) {
              return null;
            }

            const fromPosition = getTaskPosition(edge.from);
            const toPosition = getTaskPosition(edge.to);
            const midX = ((fromPosition.x + fromPosition.width / 2) + (toPosition.x + toPosition.width / 2)) / 2;
            const midY = ((fromPosition.y + fromPosition.height) + toPosition.y) / 2;

            return (
              <button
                type="button"
                onClick={() => void removeSelectedConnection()}
                className="absolute z-30 flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 shadow-lg hover:bg-red-50"
                style={{ left: midX - 16, top: midY - 16 }}
                title="Delete connection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 7H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 7L8.8 19C8.83586 19.5379 9.28247 19.9564 9.82149 19.9564H14.1785C14.7175 19.9564 15.1641 19.5379 15.2 19L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            );
          })() : null}

          {normalizedTasks.map((task) => {
            const position = getTaskPosition(task);
            return (
              <div
                key={task._id}
                className={`absolute rounded-2xl border shadow-sm ${
                  selectedTaskIds.includes(task._id)
                    ? "ring-2 ring-blue-200 dark:border-blue-400"
                    : ""
                } ${
                  task.isDone
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                    : task.isActive
                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                      : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                } ${
                  selectedTaskIds.includes(task._id) ? "border-blue-500" : ""
                }`}
                style={{
                  left: position.x,
                  top: position.y,
                  width: position.width,
                  minHeight: position.height,
                }}
              >
                <button
                  type="button"
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    if (selectionMode) {
                      return;
                    }
                    void completeConnectionToTask(task);
                  }}
                  className="absolute -top-2 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-blue-500 shadow"
                  title="Input handle"
                />
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (selectionMode) {
                      event.preventDefault();
                      toggleTaskSelection(task._id);
                      return;
                    }
                    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!rect || !canvasRef.current) {
                      return;
                    }

                    setDragging({
                      id: task._id,
                      offsetX: event.clientX - rect.left,
                      offsetY: event.clientY - rect.top,
                    });
                  }}
                  className="flex w-full cursor-grab items-center justify-between rounded-t-2xl bg-gray-900 px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.24em] text-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{task.relationshipType || "task"}</span>
                    <span>{task.taskNumber || task.rowNumber}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectionMode) {
                      toggleTaskSelection(task._id);
                      return;
                    }
                    setEditingTask(task);
                  }}
                  className="block w-full px-4 py-4 text-left"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{buildTitle(task)}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                    {task.howWillItBeDone || task.taskDescription || task.parallelSteps || task.processes || "No task details"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      {formatAllottedDaysLabel(task.allottedDays)}
                    </span>
                    {task.ownerCode ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {task.ownerCode}
                      </span>
                    ) : null}
                    {task.assigneeName ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                        {task.assigneeName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {task.spacesName ? <div>Space: {task.spacesName}</div> : null}
                    {task.status ? <div>Status: {task.status}</div> : null}
                    {task.delegationDate ? <div>Delegation: {task.delegationDate}</div> : null}
                    {task.drawingNumber ? <div>DWG: {task.drawingNumber}</div> : null}
                  </div>
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (selectionMode) {
                      return;
                    }
                    startConnectionFromTask(task);
                  }}
                  className="absolute -bottom-2 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-500 shadow"
                  title="Output handle"
                />
              </div>
            );
          })}
        </div>
      </div>

      {paginationControls}

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
                Update project task details and dependencies without leaving the flow canvas.
              </p>
            </div>

            <form onSubmit={handleTaskSave} className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Title</span>
                    <input
                      value={editingTask.title}
                      onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Number</span>
                    <input
                      value={editingTask.taskNumber}
                      onChange={(event) => setEditingTask({ ...editingTask, taskNumber: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Main Heading</span>
                    <input
                      value={editingTask.mainHeading}
                      onChange={(event) => setEditingTask({ ...editingTask, mainHeading: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Sub Heading</span>
                    <input
                      value={editingTask.subHeading}
                      onChange={(event) => setEditingTask({ ...editingTask, subHeading: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Processes</span>
                    <textarea
                      rows={3}
                      value={editingTask.processes}
                      onChange={(event) => setEditingTask({ ...editingTask, processes: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Parallel Steps / Task Details</span>
                    <textarea
                      rows={3}
                      value={editingTask.parallelSteps}
                      onChange={(event) => setEditingTask({ ...editingTask, parallelSteps: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Owner Code</span>
                    <input
                      value={editingTask.ownerCode}
                      onChange={(event) => setEditingTask({ ...editingTask, ownerCode: event.target.value.toUpperCase() })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">WHO will do it (NAME)</span>
                    <input
                      value={editingTask.assigneeName}
                      onChange={(event) => setEditingTask({ ...editingTask, assigneeName: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">HOW will it be done</span>
                    <textarea
                      rows={3}
                      value={editingTask.howWillItBeDone || ""}
                      onChange={(event) => setEditingTask({ ...editingTask, howWillItBeDone: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Allotted Days</span>
                    <input
                      type="number"
                      min="0"
                      value={editingTask.allottedDays}
                      onChange={(event) => setEditingTask({ ...editingTask, allottedDays: event.target.value || "1" })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">STATUS</span>
                    <input
                      value={editingTask.status}
                      onChange={(event) => setEditingTask({ ...editingTask, status: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE</span>
                    <input
                      value={editingTask.delegationDate}
                      onChange={(event) => setEditingTask({ ...editingTask, delegationDate: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">CHANGED DELEGATION DATE</span>
                    <input
                      value={editingTask.changedDelegationDate}
                      onChange={(event) => setEditingTask({ ...editingTask, changedDelegationDate: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DELEGATION DATE 2</span>
                    <input
                      value={editingTask.secondaryDelegationDate}
                      onChange={(event) => setEditingTask({ ...editingTask, secondaryDelegationDate: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">DWG. NO.</span>
                    <input
                      value={editingTask.drawingNumber}
                      onChange={(event) => setEditingTask({ ...editingTask, drawingNumber: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Due Rule</span>
                    <input
                      value={editingTask.dueRule}
                      onChange={(event) => setEditingTask({ ...editingTask, dueRule: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Relationship</span>
                    <select
                      value={editingTask.relationshipType}
                      onChange={(event) => setEditingTask({ ...editingTask, relationshipType: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="root">Root</option>
                      <option value="sequential">Sequential</option>
                      <option value="parallel">Parallel</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Task Link</span>
                    <input
                      value={editingTask.taskLink}
                      onChange={(event) => setEditingTask({ ...editingTask, taskLink: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Dependencies</h4>
                    <button
                      type="button"
                      onClick={() => setEditingTask({ ...editingTask, dependsOnTaskIds: [] })}
                      className="text-sm font-medium text-red-600"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid max-h-52 gap-3 overflow-y-auto rounded-2xl border border-gray-200 p-4 dark:border-gray-700 md:grid-cols-2">
                    {localTasks
                      .filter((task) => task._id !== editingTask._id)
                      .map((task) => {
                        const checked = selectedDependencyIds.has(task._id);
                        return (
                          <label key={task._id} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...editingTask.dependsOnTaskIds, task._id]
                                  : editingTask.dependsOnTaskIds.filter((id) => id !== task._id);
                                setEditingTask({ ...editingTask, dependsOnTaskIds: Array.from(new Set(next)) });
                              }}
                              className="mt-1"
                            />
                            <span>{buildTitle(task)}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
                  >
                    Save Task
                  </button>
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
              Only fields you type will be updated across {selectedTaskIds.length} selected tasks.
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
                disabled={bulkSaving}
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {bulkSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
