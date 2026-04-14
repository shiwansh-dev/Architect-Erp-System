"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { FmsTask, FmsTemplate } from "./fmsTemplateTypes";
import Pagination from "@/components/tables/Pagination";

type TemplateDetails = {
  template: FmsTemplate;
  tasks: FmsTask[];
  ownerCodes?: string[];
  validation?: {
    invalidOwnerCodeCount: number;
    currentPageInvalidTaskIds: string[];
    firstInvalidTaskId: string;
    firstInvalidPage: number | null;
    ownerCodes: string[];
  };
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

type SelectedEdge = {
  sourceId: string;
  targetId: string;
};

type ConnectionDrag = {
  sourceId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 132;
const VIEWPORT_BUFFER = 600;

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

  return normalizeTaskPositions(
    tasks.map((task) => positioned.get(task._id) || byId.get(task._id) || task)
  );
}

export default function FmsTemplateFlow() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const flowSectionRef = useRef<HTMLDivElement | null>(null);
  const tasksRef = useRef<FmsTask[]>([]);
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [template, setTemplate] = useState<FmsTemplate | null>(null);
  const [tasks, setTasks] = useState<FmsTask[]>([]);
  const [ownerCodes, setOwnerCodes] = useState<string[]>([]);
  const [validation, setValidation] = useState({
    invalidOwnerCodeCount: 0,
    currentPageInvalidTaskIds: [] as string[],
    firstInvalidTaskId: "",
    firstInvalidPage: null as number | null,
    ownerCodes: [] as string[],
  });
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState("");
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
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);
  const [viewport, setViewport] = useState<ViewportRect>({
    left: 0,
    top: 0,
    right: 1800,
    bottom: 1200,
  });
  const PAGE_SIZE = 150;

  const applyTemplateDetails = (data: TemplateDetails) => {
    setTemplate(data.template);
    setTasks(layoutTasksVertically(data.tasks));
    setOwnerCodes(data.ownerCodes || []);
    setValidation(
      data.validation || {
        invalidOwnerCodeCount: 0,
        currentPageInvalidTaskIds: [],
        firstInvalidTaskId: "",
        firstInvalidPage: null,
        ownerCodes: data.ownerCodes || [],
      }
    );
    setSelectedEdge(null);
    setConnectionDrag(null);
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
  };

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

        applyTemplateDetails(data);
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
    if (!pendingFocusTaskId) {
      return;
    }

    const container = scrollContainerRef.current;
    const targetTask = tasks.find((task) => task._id === pendingFocusTaskId);
    if (!container || !targetTask) {
      return;
    }

    window.requestAnimationFrame(() => {
      flowSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const position = getTaskPosition(targetTask);
      container.scrollTo({
        left: Math.max(0, position.x - container.clientWidth / 2 + position.width / 2),
        top: Math.max(0, position.y - container.clientHeight / 2 + position.height / 2),
        behavior: "smooth",
      });
      setPendingFocusTaskId("");
    });
  }, [pendingFocusTaskId, tasks]);

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

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task._id, task])), [tasks]);

  const edges = useMemo(() => {
    const allEdges: Array<{ from: FmsTask; to: FmsTask; type: string; sourceId: string; targetId: string }> = [];
    tasks.forEach((task) => {
      task.dependsOnTaskIds.forEach((dependencyId) => {
        const source = taskMap.get(dependencyId);
        if (source) {
          allEdges.push({
            from: source,
            to: task,
            type: task.relationshipType,
            sourceId: source._id,
            targetId: task._id,
          });
        }
      });
    });
    return allEdges;
  }, [taskMap, tasks]);

  const canvasSize = useMemo(() => {
    const maxX = tasks.reduce((acc, task) => {
      const position = getTaskPosition(task);
      return Math.max(acc, position.x + position.width);
    }, 900);
    const maxY = tasks.reduce((acc, task) => {
      const position = getTaskPosition(task);
      return Math.max(acc, position.y + position.height);
    }, 600);
    return { width: maxX + 160, height: maxY + 160 };
  }, [tasks]);

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>();

    tasks.forEach((task) => {
      const position = getTaskPosition(task);
      const width = position.width;
      const height = position.height;
      const left = position.x;
      const top = position.y;
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
  const invalidTaskIdSet = useMemo(
    () => new Set(validation.currentPageInvalidTaskIds),
    [validation.currentPageInvalidTaskIds]
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) => visibleTaskIds.has(edge.from._id) || visibleTaskIds.has(edge.to._id)
      ),
    [edges, visibleTaskIds]
  );

  const persistTaskUpdate = async (
    taskId: string,
    payload: Partial<FmsTask> & { dependsOnTaskIds?: string[]; relationshipType?: string }
  ) => {
    const response = await fetch(`/api/templates/fms/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update task");
    }

    setTasks((currentTasks) =>
      currentTasks.map((item) => (item._id === taskId ? data.task : item))
    );

    return data.task as FmsTask;
  };

  const handleResetLayout = async () => {
    if (!selectedTemplateId) {
      return;
    }

    const confirmed = window.confirm(
      "Reset all saved task positions for this template and return to the default layout?"
    );
    if (!confirmed) {
      return;
    }

    try {
      setDetailsLoading(true);
      setError("");
      setSaveMessage("");

      const params = new URLSearchParams({
        view: "flow",
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/templates/fms/${selectedTemplateId}?${params.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-layout" }),
      });
      const data: TemplateDetails | { error: string } = await response.json();

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to reset layout");
      }

      applyTemplateDetails(data);
      setSelectedEdge(null);
      setConnectionDrag(null);
      setEditingTask(null);
      setSaveMessage("Layout reset to default.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset layout");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSaveLayout = async () => {
    if (!selectedTemplateId || !tasks.length) {
      return;
    }

    try {
      setSavingLayout(true);
      setError("");
      setSaveMessage("");

      const params = new URLSearchParams({
        view: "flow",
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/templates/fms/${selectedTemplateId}?${params.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-layout",
          tasks: tasks.map((task) => ({
            _id: task._id,
            position: getTaskPosition(task),
          })),
        }),
      });
      const data: TemplateDetails | { error: string } = await response.json();

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to save layout");
      }

      applyTemplateDetails(data);
      setSaveMessage("Layout saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save layout");
    } finally {
      setSavingLayout(false);
    }
  };

  const startConnectionFromTask = (task: FmsTask) => {
    setSelectedEdge(null);
    const position = getTaskPosition(task);
    const width = position.width;
    const height = position.height;
    setConnectionDrag({
      sourceId: task._id,
      startX: position.x + width / 2,
      startY: position.y + height,
      currentX: position.x + width / 2,
      currentY: position.y + height,
    });
    setSaveMessage(`Connecting from ${buildTitle(task)}.`);
  };

  const completeConnectionToTask = async (task: FmsTask) => {
    if (!connectionDrag || connectionDrag.sourceId === task._id) {
      return;
    }

    const nextDependencies = Array.from(
      new Set([...(task.dependsOnTaskIds || []), connectionDrag.sourceId])
    );

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

    const targetTask = tasks.find((task) => task._id === selectedEdge.targetId);
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
      setSaveMessage("Task updated. Save layout if you want to persist node positions.");
      setTasks((currentTasks) =>
        {
          const previousTask = currentTasks.find((task) => task._id === editingTask._id);
          const normalizedOwnerCode = String(editingTask.ownerCode || "").trim().toUpperCase();
          const previousHasOwnerCodeError = Boolean(previousTask?.hasOwnerCodeError);
          const nextHasOwnerCodeError =
            ownerCodes.length > 0 && Boolean(normalizedOwnerCode) && !ownerCodes.includes(normalizedOwnerCode);

          const nextTasks = currentTasks.map((task) => {
          if (task._id !== editingTask._id) {
            return task;
          }

          return {
            ...task,
            ...editingTask,
            ownerCode: normalizedOwnerCode,
            hasOwnerCodeError: nextHasOwnerCodeError,
          };
          });

          setValidation((currentValidation) => {
            const currentPageInvalidTaskIds = nextTasks
              .filter((task) => task.hasOwnerCodeError)
              .map((task) => task._id);
            const invalidOwnerCodeCount = Math.max(
              0,
              currentValidation.invalidOwnerCodeCount +
                (nextHasOwnerCodeError ? 1 : 0) -
                (previousHasOwnerCodeError ? 1 : 0)
            );

            return {
              ...currentValidation,
              invalidOwnerCodeCount,
              currentPageInvalidTaskIds,
              firstInvalidTaskId:
                currentValidation.firstInvalidTaskId === editingTask._id && !nextHasOwnerCodeError
                  ? currentPageInvalidTaskIds[0] || ""
                  : currentValidation.firstInvalidTaskId || currentPageInvalidTaskIds[0] || "",
              firstInvalidPage:
                invalidOwnerCodeCount > 0
                  ? currentValidation.firstInvalidPage || currentPage
                  : null,
            };
          });

          return nextTasks;
        }
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update task");
    }
  };

  const handleShowError = () => {
    if (!validation.invalidOwnerCodeCount) {
      return;
    }

    const targetPage = validation.firstInvalidPage;
    const targetTaskId = validation.firstInvalidTaskId;
    if (!targetPage || !targetTaskId) {
      return;
    }

    setPendingFocusTaskId(targetTaskId);
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      return;
    }

    const container = scrollContainerRef.current;
    const targetTask = tasks.find((task) => task._id === targetTaskId);
    if (!container || !targetTask) {
      return;
    }

    flowSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const position = getTaskPosition(targetTask);
    container.scrollTo({
      left: Math.max(0, position.x - container.clientWidth / 2 + position.width / 2),
      top: Math.max(0, position.y - container.clientHeight / 2 + position.height / 2),
      behavior: "smooth",
    });
  };

  const selectedDependencyIds = new Set(editingTask?.dependsOnTaskIds || []);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Task Flow</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Use this canvas to review task dependencies, drag tasks into place, and create or edit task-to-task links.
        </p>
      </div>

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
              onClick={() => void handleSaveLayout()}
              disabled={!template || detailsLoading || savingLayout || !tasks.length}
              className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingLayout ? "Saving..." : "Save Layout"}
            </button>
            <button
              type="button"
              onClick={() => void handleResetLayout()}
              disabled={!template || detailsLoading || savingLayout}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Reset Layout
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

        {validation.invalidOwnerCodeCount ? (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-medium text-red-700">
              {validation.invalidOwnerCodeCount} task{validation.invalidOwnerCodeCount === 1 ? "" : "s"} have owner codes outside Master Roles.
            </p>
            <button
              type="button"
              onClick={handleShowError}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Show
            </button>
          </div>
        ) : null}

        {connectionDrag ? (
          <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Drag from a node&apos;s bottom handle to another node&apos;s top handle to create or rewire a connection.
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
          <div ref={flowSectionRef}>
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
              <svg className="absolute inset-0 h-full w-full">
                {visibleEdges.map((edge, index) => (
                  <g key={`${edge.from._id}-${edge.to._id}-${index}`}>
                    <path
                      d={getEdgePath(edge.from, edge.to)}
                      stroke="transparent"
                      strokeWidth="18"
                      fill="none"
                      strokeLinecap="round"
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() => {
                        setSelectedEdge({
                          sourceId: edge.sourceId,
                          targetId: edge.targetId,
                        });
                        setConnectionDrag(null);
                        setSaveMessage(
                          `Selected connection from ${buildTitle(edge.from)} to ${buildTitle(edge.to)}.`
                        );
                      }}
                    />
                    <path
                      d={getEdgePath(edge.from, edge.to)}
                      stroke={
                        selectedEdge?.sourceId === edge.sourceId &&
                        selectedEdge?.targetId === edge.targetId
                          ? "#dc2626"
                          : edge.type === "parallel"
                            ? "#3b82f6"
                            : edge.type === "manual"
                              ? "#f59e0b"
                              : "#111827"
                      }
                      strokeWidth={
                        selectedEdge?.sourceId === edge.sourceId &&
                        selectedEdge?.targetId === edge.targetId
                          ? "4"
                          : "2.5"
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
                  (item) =>
                    item.sourceId === selectedEdge.sourceId &&
                    item.targetId === selectedEdge.targetId
                );
                if (!edge) {
                  return null;
                }

                const fromPosition = getTaskPosition(edge.from);
                const toPosition = getTaskPosition(edge.to);
                const midX =
                  ((fromPosition.x + fromPosition.width / 2) +
                    (toPosition.x + toPosition.width / 2)) / 2;
                const midY =
                  ((fromPosition.y + fromPosition.height) + toPosition.y) / 2;

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

              {visibleTasks.map((task) => {
                const isConnectionStart = connectionDrag?.sourceId === task._id;
                const position = getTaskPosition(task);
                const hasOwnerCodeError = invalidTaskIdSet.has(task._id) || task.hasOwnerCodeError;
                return (
                  <div
                    key={task._id}
                    className={`absolute rounded-2xl border bg-white shadow-lg transition dark:bg-gray-900 ${
                      isConnectionStart
                        ? "border-blue-500 ring-2 ring-blue-300"
                        : hasOwnerCodeError
                          ? "border-red-400 ring-2 ring-red-200 hover:border-red-500 dark:border-red-800"
                          : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
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
                        void completeConnectionToTask(task);
                      }}
                      className="absolute -top-2 left-1/2 z-20 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-blue-500 shadow"
                      title="Input handle"
                    />
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
                      onClick={() => setEditingTask(task)}
                      className="block w-full px-4 py-4 text-left"
                    >
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{buildTitle(task)}</div>
                      <div className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                        {task.taskDescription || task.parallelSteps || task.processes || "No task details"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.ownerCode ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              hasOwnerCodeError
                                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {task.ownerCode}
                          </span>
                        ) : null}
                        {hasOwnerCodeError ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-200">
                            Invalid owner role
                          </span>
                        ) : null}
                        {task.assigneeName ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                            {task.assigneeName}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
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
          </div>
        )}
      </div>

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
                Update task details and dependencies without leaving the flow canvas.
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
                  <select
                    value={editingTask.ownerCode}
                    onChange={(event) => setEditingTask({ ...editingTask, ownerCode: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  >
                    <option value="">Select role</option>
                    {ownerCodes.map((ownerCode) => (
                      <option key={ownerCode} value={ownerCode}>
                        {ownerCode}
                      </option>
                    ))}
                    {editingTask.ownerCode && !ownerCodes.includes(editingTask.ownerCode) ? (
                      <option value={editingTask.ownerCode}>{editingTask.ownerCode} (invalid)</option>
                    ) : null}
                  </select>
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
    </div>
  );
}
