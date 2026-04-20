"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import FmsTemplateNav from "./FmsTemplateNav";
import type { FmsTemplate } from "./fmsTemplateTypes";

type ApiState = {
  templates: FmsTemplate[];
  latestTemplate: FmsTemplate | null;
};

export default function FmsTemplateManagePage() {
  const [templates, setTemplates] = useState<FmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<FmsTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/templates/fms", { cache: "no-store" });
      const data: ApiState | { error: string } = await response.json();

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to load templates");
      }

      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleEdit = (template: FmsTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name || "");
    setError("");
  };

  const handleUpdateTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTemplate) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/templates/fms/${editingTemplate._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update-metadata",
          name: templateName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update template");
      }

      setTemplates((current) =>
        current.map((template) => (template._id === editingTemplate._id ? data.template : template))
      );
      setMessage("Template updated successfully.");
      setEditingTemplate(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (template: FmsTemplate) => {
    const confirmed = window.confirm(`Archive ${template.name}? It will be moved out of the active template collection.`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`/api/templates/fms/${template._id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive template");
      }

      setTemplates((current) => current.filter((item) => item._id !== template._id));
      setMessage(`${template.name} archived successfully.`);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive template");
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Manage Templates</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Review all active templates, edit template names, or archive templates into a separate collection.
        </p>
      </div>

      <FmsTemplateNav />

      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Template Library</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{templates.length} active template(s)</p>
          </div>
          <Link
            href="/Templates/fms-template"
            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Upload Template
          </Link>
        </div>

        {message ? <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading templates...</p>
        ) : templates.length ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Template</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Source File</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Tasks</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Imported</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template._id} className="border-t border-gray-200 align-top dark:border-gray-800">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{template.name}</div>
                      {template.sheetName ? (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{template.sheetName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{template.sourceFileName || "-"}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{template.totalTasks || 0}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                      {template.importedAt ? new Date(template.importedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(template)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(template)}
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
          <p className="text-sm text-gray-500 dark:text-gray-400">No templates imported yet.</p>
        )}
      </div>

      <Modal
        isOpen={Boolean(editingTemplate)}
        onClose={() => setEditingTemplate(null)}
        className="m-4 max-w-xl"
      >
        {editingTemplate ? (
          <div className="rounded-3xl bg-white p-6 dark:bg-gray-900">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Template</h3>
            <form onSubmit={handleUpdateTemplate} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Template Name</span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
