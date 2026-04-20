"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FmsTask, FmsTemplate } from "./fmsTemplateTypes";
import Pagination from "@/components/tables/Pagination";
import { DEFAULT_FMS_SECONDARY_HEADERS } from "@/lib/fms-table-headers";

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

const OWNER_CODE_COLUMN_INDEX = 7;
const ALLOTTED_DAYS_COLUMN_INDEX = 19;
const HOW_WILL_IT_BE_DONE_LABEL = "HOW will it be done";
const TASK_LINK_COLUMN_INDEX = 21;

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export default function FmsTemplateTable() {
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [template, setTemplate] = useState<FmsTemplate | null>(null);
  const [tasks, setTasks] = useState<FmsTask[]>([]);
  const [validation, setValidation] = useState({
    invalidOwnerCodeCount: 0,
    currentPageInvalidTaskIds: [] as string[],
    firstInvalidTaskId: "",
    firstInvalidPage: null as number | null,
    ownerCodes: [] as string[],
  });
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 100,
    totalTasks: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

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
        const initialId = data.latestTemplate?._id || data.templates?.[0]?._id || "";
        setSelectedTemplateId(initialId);
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
          view: "table",
          page: String(currentPage),
          limit: String(pageSize),
        });
        const response = await fetch(`/api/templates/fms/${selectedTemplateId}?${params.toString()}`, {
          cache: "no-store",
        });
        const data: TemplateDetails | { error: string } = await response.json();

        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load template");
        }

        setTemplate(data.template);
        setTasks(data.tasks);
        setValidation(
          data.validation || {
            invalidOwnerCodeCount: 0,
            currentPageInvalidTaskIds: [],
            firstInvalidTaskId: "",
            firstInvalidPage: null,
            ownerCodes: data.ownerCodes || [],
          }
        );
        setPagination(
          data.pagination || {
            currentPage: 1,
            limit: pageSize,
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
  }, [selectedTemplateId, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, selectedTemplateId]);

  useEffect(() => {
    if (!pendingFocusTaskId) {
      return;
    }

    const row = rowRefs.current[pendingFocusTaskId];
    if (!row) {
      return;
    }

    window.requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingFocusTaskId("");
    });
  }, [pendingFocusTaskId, tasks]);

  const invalidTaskIdSet = useMemo(
    () => new Set(validation.currentPageInvalidTaskIds),
    [validation.currentPageInvalidTaskIds]
  );
  const headerRow1 = useMemo(
    () => (template ? [...template.headerRow1, ""] : []),
    [template]
  );
  const headerRow2 = useMemo(
    () =>
      template
        ? [
            ...template.headerRow2.map((cell, index) => cell || DEFAULT_FMS_SECONDARY_HEADERS[index] || `COLUMN ${index + 1}`),
            HOW_WILL_IT_BE_DONE_LABEL,
          ]
        : [],
    [template]
  );

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

    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const row = rowRefs.current[targetTaskId];
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Template Tasks</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This view keeps the spreadsheet-style layout so the imported template remains easy to compare against the source CSV.
        </p>
      </div>

      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Template Viewer</h2>
            {template ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {template.name} • {pagination.totalTasks || template.totalTasks} tasks
              </p>
            ) : null}
          </div>

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
        </div>

        {loading || detailsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading template data...</p>
        ) : error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : template ? (
          <div ref={contentRef} className="space-y-4">
            {validation.invalidOwnerCodeCount ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-medium text-red-700">
                  {validation.invalidOwnerCodeCount} task{validation.invalidOwnerCodeCount === 1 ? "" : "s"} have owner codes that are not in Master Roles.
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

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(pagination.currentPage - 1) * pagination.limit + 1}-
                {Math.min(pagination.currentPage * pagination.limit, pagination.totalTasks || tasks.length)} of{" "}
                {pagination.totalTasks || tasks.length} rows
              </p>
              {paginationControls}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
              <table className="min-w-[2140px] border-collapse text-left text-xs">
                <thead>
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
                <tbody>
                  {tasks.map((task, rowIndex) => {
                    const row = [...(task.rawCells || []), task.howWillItBeDone || ""];
                    const hasOwnerCodeError = invalidTaskIdSet.has(task._id) || task.hasOwnerCodeError;
                    return (
                    <tr
                      key={task._id}
                      ref={(element) => {
                        rowRefs.current[task._id] = element;
                      }}
                      className={`align-top odd:bg-white even:bg-gray-50/60 dark:odd:bg-gray-950 dark:even:bg-gray-900/40 ${
                        hasOwnerCodeError ? "bg-red-50/80 ring-1 ring-inset ring-red-200 dark:bg-red-950/20" : ""
                      }`}
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className={`max-w-[240px] whitespace-pre-wrap break-words [overflow-wrap:anywhere] border px-3 py-2 text-gray-700 dark:text-gray-300 ${
                            hasOwnerCodeError && cellIndex === OWNER_CODE_COLUMN_INDEX
                              ? "border-red-300 bg-red-100/80 font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                              : cellIndex === ALLOTTED_DAYS_COLUMN_INDEX
                                ? "border-emerald-200 bg-emerald-50/70 font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : "border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          {cellIndex === TASK_LINK_COLUMN_INDEX && isHttpUrl(cell) ? (
                            <a
                              href={cell}
                              target="_blank"
                              rel="noopener noreferrer"
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
                  )})}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">{paginationControls}</div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No template selected.</p>
        )}
      </div>
    </div>
  );
}
