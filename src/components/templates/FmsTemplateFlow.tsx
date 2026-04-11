"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import FmsTemplateNav from "./FmsTemplateNav";
import type { FmsTask, FmsTemplate } from "./fmsTemplateTypes";
import Pagination from "@/components/tables/Pagination";

type TemplateDetails = {
  template: FmsTemplate;
  tasks: FmsTask[];
  pagination?: {
    currentPage: number;
    limit: number;
    totalTasks: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  } | null;
};

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
};

type ViewportRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 132;
const VIEWPORT_BUFFER = 600;

function getEdgePath(source: FmsTask, target: FmsTask) {
  const sourceX = source.position.x + (source.position.width || NODE_WIDTH) / 2;
  const sourceY = source.position.y + (source.position.height || NODE_HEIGHT);
  const targetX = target.position.x + (target.position.width || NODE_WIDTH) / 2;
  const targetY = target.position.y;
  const curve = Math.max(80, Math.abs(targetY - sourceY) / 2);

  return `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + curve}, ${targetX} ${targetY - curve}, ${targetX} ${targetY}`;
}

function buildTitle(task: FmsTask) {
  return task.title || [task.taskNumber ? `#${task.taskNumber}` : "", task.processes || task.parallelSteps || task.taskDescription].filter(Boolean).join(" ");
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
      positioned.set(current.task._id, {
        ...current.task,
        position: {
          ...current.task.position,
          x: 80 + current.column * 320,
          y: 80 + current.row * 220,
          width: current.task.position.width || NODE_WIDTH,
          height: current.task.position.height || NODE_HEIGHT,
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

  return tasks.map((task) => positioned.get(task._id) || byId.get(task._id) || task);
}

export default function FmsTemplateFlow() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tasksRef = useRef<FmsTask[]>([]);
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [template, setTemplate] = useState<FmsTemplate | null>(null);
  const [tasks, setTasks] = useState<FmsTask[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 150,
    totalTasks: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [editingTask, setEditingTask] = useState<FmsTask | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [viewport, setViewport] = useState<ViewportRect>({
    left: 0,
    top: 0,
    right: 1800,
    bottom: 1200,
  });
  const PAGE_SIZE = 150;

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/templates/fms", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load templates");
        }

        setTemplates(data.templates);
        setSelectedTemplateId(data.latestTemplate?._id || data.templates?.[0]?._id || "");
        setCurrentPage(1);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    void loadLibrary();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    const loadTemplateDetails = async () => {
      try {
        setDetailsLoading(true);
        setError("");
        const params = new URLSearchParams({
          view: "flow",
          page: String(currentPage),
          limit: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/templates/fms/${selectedTemplateId}?${params.toString()}`, {
          cache: "no-store",
        });
        const data: TemplateDetails | { error: string } = await response.json();
        
        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load template");
        }

        setTemplate(data.template);
        setTasks(layoutTasksVertically(data.tasks));
        setPagination(
          data.pagination || {
            currentPage: 1,
            limit: PAGE_SIZE,
            totalTasks: data.tasks.length,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          }
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load template");
      } finally {
        setDetailsLoading(false);
      }
    };

    void loadTemplateDetails();
  }, [selectedTemplateId, currentPage]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    let frameId = 0;
    const updateViewport = () => {
      frameId = 0;
      setViewport({
        left: container.scrollLeft - VIEWPORT_BUFFER,
        top: container.scrollTop - VIEWPORT_BUFFER,
        right: container.scrollLeft + container.clientWidth + VIEWPORT_BUFFER,
        bottom: container.scrollTop + container.clientHeight + VIEWPORT_BUFFER,
      });
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [template, tasks.length]);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) {
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task._id === dragging.id
            ? {
                ...task,
                position: {
                  ...task.position,
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
        await fetch(`/api/templates/fms/tasks/${task._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            position: task.position,
          }),
        });
      } catch (saveError) {
        console.error("Failed to persist node position", saveError);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging]);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task._id, task])), [tasks]);

  const edges = useMemo(() => {
    const allEdges: Array<{ from: FmsTask; to: FmsTask; type: string }> = [];
    tasks.forEach((task) => {
      task.dependsOnTaskIds.forEach((dependencyId) => {
        const source = taskMap.get(dependencyId);
        if (source) {
          allEdges.push({ from: source, to: task, type: task.relationshipType });
        }
      });
    });
    return allEdges;
  }, [taskMap, tasks]);

  const canvasSize = useMemo(() => {
    const maxX = tasks.reduce((acc, task) => Math.max(acc, task.position.x + (task.position.width || NODE_WIDTH)), 900);
    const maxY = tasks.reduce((acc, task) => Math.max(acc, task.position.y + (task.position.height || NODE_HEIGHT)), 600);
    return { width: maxX + 160, height: maxY + 160 };
  }, [tasks]);

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>();

    tasks.forEach((task) => {
      const width = task.position.width || NODE_WIDTH;
      const height = task.position.height || NODE_HEIGHT;
      const left = task.position.x;
      const top = task.position.y;
      const right = left + width;
      const bottom = top + height;

      const intersects =
        right >= viewport.left &&
        left <= viewport.right &&
        bottom >= viewport.top &&
        top <= viewport.bottom;

      if (intersects) {
        ids.add(task._id);
      }
    });

    return ids;
  }, [tasks, viewport]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => visibleTaskIds.has(task._id)),
    [tasks, visibleTaskIds]
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) => visibleTaskIds.has(edge.from._id) || visibleTaskIds.has(edge.to._id)
      ),
    [edges, visibleTaskIds]
  );

  const openOrConnectTask = async (task: FmsTask) => {
    if (!connectMode) {
      setEditingTask(task);
      return;
    }

    if (!connectionStartId) {
      setConnectionStartId(task._id);
      setSaveMessage(`Connecting from ${buildTitle(task)}`);
      return;
    }

    if (connectionStartId === task._id) {
      setConnectionStartId(null);
      setSaveMessage("");
      return;
    }

    const nextDependencies = Array.from(new Set([...(task.dependsOnTaskIds || []), connectionStartId]));

    try {
      const response = await fetch(`/api/templates/fms/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dependsOnTaskIds: nextDependencies,
          relationshipType: "manual",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create connection");
      }

      setTasks((currentTasks) =>
        currentTasks.map((item) => (item._id === task._id ? data.task : item))
      );
      setSaveMessage("Connection saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save connection");
    } finally {
      setConnectionStartId(null);
    }
  };

  const handleTaskSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingTask) {
      return;
    }

    const response = await fetch(`/api/templates/fms/tasks/${editingTask._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingTask),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Failed to update task");
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((item) => (item._id === editingTask._id ? data.task : item))
    );
    setEditingTask(null);
    setSaveMessage("Task updated.");
  };

  const selectedDependencyIds = new Set(editingTask?.dependsOnTaskIds || []);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">FMS Template Flow</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Use this canvas to review task dependencies, drag tasks into place, and create or edit task-to-task links.
        </p>
      </div>

      <FmsTemplateNav />

      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Select template</option>
              {templates.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setConnectMode((current) => !current);
                setConnectionStartId(null);
                setSaveMessage("");
              }}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                connectMode
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {connectMode ? "Exit Connect Mode" : "Connect Tasks"}
            </button>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {template ? `${template.name} • ${pagination.totalTasks || tasks.length} tasks` : "Select a template"}
          </div>
        </div>

        {template ? (
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(pagination.currentPage - 1) * pagination.limit + 1}-
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalTasks || tasks.length)} of{" "}
              {pagination.totalTasks || tasks.length} tasks
            </p>
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
        ) : null}

        {saveMessage ? (
          <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{saveMessage}</div>
        ) : null}

        {loading || detailsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading flow data...</p>
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : !template ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No template selected.</p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
          >
            <div
              ref={canvasRef}
              className="relative"
              style={{
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(148,163,184,.35) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            >
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {visibleEdges.map((edge, index) => (
                  <path
                    key={`${edge.from._id}-${edge.to._id}-${index}`}
                    d={getEdgePath(edge.from, edge.to)}
                    stroke={edge.type === "parallel" ? "#3b82f6" : edge.type === "manual" ? "#f59e0b" : "#111827"}
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              {visibleTasks.map((task) => {
                const isConnectionStart = connectionStartId === task._id;
                return (
                  <div
                    key={task._id}
                    className={`absolute rounded-2xl border bg-white shadow-lg transition dark:bg-gray-900 ${
                      isConnectionStart
                        ? "border-blue-500 ring-2 ring-blue-300"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                    }`}
                    style={{
                      left: task.position.x,
                      top: task.position.y,
                      width: task.position.width || NODE_WIDTH,
                      minHeight: task.position.height || NODE_HEIGHT,
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => {
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
                      <span>{task.relationshipType || "task"}</span>
                      <span>{task.taskNumber || task.rowNumber}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void openOrConnectTask(task)}
                      className="block w-full px-4 py-4 text-left"
                    >
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{buildTitle(task)}</div>
                      <div className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                        {task.taskDescription || task.parallelSteps || task.processes || "No task details"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(editingTask)} onClose={() => setEditingTask(null)} className="max-w-[860px] m-4">
        {editingTask ? (
          <div className="relative w-full rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Task</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update task details and dependencies without leaving the flow canvas.
            </p>

            <form onSubmit={handleTaskSave} className="mt-6 space-y-6">
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
                    onChange={(event) => setEditingTask({ ...editingTask, ownerCode: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Assignee Name</span>
                  <input
                    value={editingTask.assigneeName}
                    onChange={(event) => setEditingTask({ ...editingTask, assigneeName: event.target.value })}
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
                  {tasks
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

              <div className="flex flex-wrap justify-end gap-3">
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
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
