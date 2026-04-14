"use client";

import { useEffect, useMemo, useState } from "react";

type Role = {
  _id: string;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const emptyForm = {
  roleCode: "",
  roleName: "",
  isActive: true,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/master/roles", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load roles");
      }

      setRoles(data.roles || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const filteredRoles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return roles;
    }

    return roles.filter((role) =>
      [role.roleCode, role.roleName].some((value) => value?.toLowerCase().includes(query))
    );
  }, [roles, searchTerm]);

  const resetForm = () => {
    setEditingRole(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        roleCode: form.roleCode.trim().toUpperCase(),
        roleName: form.roleName.trim(),
        isActive: form.isActive,
      };

      const url = editingRole ? `/api/master/roles/${editingRole._id}` : "/api/master/roles";
      const method = editingRole ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save role");
      }

      await loadRoles();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      roleCode: role.roleCode || "",
      roleName: role.roleName || "",
      isActive: role.isActive !== false,
    });
  };

  const handleDelete = async (roleId: string) => {
    if (!window.confirm("Delete this role?")) {
      return;
    }

    try {
      setError("");
      const response = await fetch(`/api/master/roles/${roleId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete role");
      }

      await loadRoles();
      if (editingRole?._id === roleId) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete role");
    }
  };

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-4 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Roles</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Create owner role codes like <code>PD</code> and <code>DIR</code>. FMS tasks using other owner codes will be flagged as errors.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search roles..."
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingRole ? "Edit Role" : "Create Role"}
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Role Code</span>
                <input
                  value={form.roleCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      roleCode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="PD"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700 dark:text-gray-300">Role Name</span>
                <input
                  value={form.roleName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      roleName: event.target.value,
                    }))
                  }
                  placeholder="Project Director"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </label>

              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
              </button>
              {editingRole ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Roles</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">{filteredRoles.length} roles</span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</p>
            ) : filteredRoles.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No roles found.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Code</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Name</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoles.map((role) => (
                      <tr key={role._id} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{role.roleCode}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{role.roleName || "-"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              role.isActive !== false
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {role.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(role)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(role._id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
