"use client";

import { useEffect, useMemo, useState } from "react";
import FmsTemplateNav from "./FmsTemplateNav";
import type { FmsTemplate } from "./fmsTemplateTypes";

type ApiState = {
  templates: FmsTemplate[];
  latestTemplate: FmsTemplate | null;
};

export default function FmsTemplateUploader() {
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [latestTemplate, setLatestTemplate] = useState<FmsTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTemplates = async () => {
    try {
      setBootLoading(true);
      const response = await fetch("/api/templates/fms", { cache: "no-store" });
      const data: ApiState | { error: string } = await response.json();

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to load templates");
      }

      setTemplates(data.templates);
      setLatestTemplate(data.latestTemplate);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load templates");
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const stats = useMemo(() => {
    const totalTemplates = templates.length;
    const totalTasks = templates.reduce((sum, item) => sum + item.totalTasks, 0);
    return { totalTemplates, totalTasks };
  }, [templates]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a CSV file to upload.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (templateName.trim()) {
        formData.append("templateName", templateName.trim());
      }

      const response = await fetch("/api/templates/fms", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import template");
      }

      setMessage(`Imported ${data.template.name} with ${data.template.totalTasks} tasks.`);
      setTemplateName("");
      setFile(null);
      const input = document.getElementById("fms-template-file") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await loadTemplates();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to import template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Templates</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload an FMS CSV, persist every task into MongoDB, and reuse it in table and flow layouts.
        </p>
      </div>

      <FmsTemplateNav />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload FMS Template</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            The importer reads the sheet structure, stores the raw row layout, and seeds initial task dependencies.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Template Name
              </label>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="FMS Template - Residential"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                CSV File
              </label>
              <input
                id="fms-template-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:border-gray-700 dark:text-gray-200 dark:file:bg-white dark:file:text-gray-900"
              />
            </div>

            {message ? (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
            ) : null}
            {error ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Importing..." : "Upload Template"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Library Stats</h2>
            {bootLoading ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading template library...</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Templates</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalTemplates}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Stored Tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalTasks}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Latest Import</h2>
            {latestTemplate ? (
              <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  <span className="font-medium text-gray-900 dark:text-white">{latestTemplate.name}</span>
                </p>
                <p>Source file: {latestTemplate.sourceFileName}</p>
                <p>Tasks: {latestTemplate.totalTasks}</p>
                <p>Imported: {new Date(latestTemplate.importedAt).toLocaleString()}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                No FMS template has been imported yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
