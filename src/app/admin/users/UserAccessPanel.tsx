"use client";

import { useCallback, useMemo, useState } from "react";

import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { USER_ROLES } from "@/lib/auth/roles";

type UserAccessListItem = {
  id: string;
  email: string;
  displayName: string;
  role: string | null;
  status: string | null;
  tenantId: string;
  tenantRole: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserAccessPanelProps = {
  tenantId: string;
  initialUsers: UserAccessListItem[];
};

type UserAccessUpdate = {
  role?: string | null;
  displayName?: string | null;
  tenantRole?: string | null;
  status?: string | null;
};

const ROLE_OPTIONS = [
  { value: USER_ROLES.ADMIN, label: "Admin" },
  { value: USER_ROLES.SYSTEM_ADMIN, label: "System admin" },
  { value: USER_ROLES.TENANT_ADMIN, label: "Tenant admin" },
  { value: USER_ROLES.DATA_ACCESS, label: "Data access" },
  { value: USER_ROLES.MANAGER, label: "Manager" },
  { value: USER_ROLES.RECRUITER, label: "Recruiter" },
  { value: USER_ROLES.SOURCER, label: "Sourcer" },
  { value: USER_ROLES.SALES, label: "Sales" },
  { value: USER_ROLES.EXEC, label: "Exec" },
  { value: USER_ROLES.FULFILLMENT_SOURCER, label: "Fulfillment sourcer" },
  { value: USER_ROLES.FULFILLMENT_RECRUITER, label: "Fulfillment recruiter" },
  { value: USER_ROLES.FULFILLMENT_MANAGER, label: "Fulfillment manager" },
];

const TENANT_ROLE_OPTIONS = [
  { value: "NONE", label: "No tenant access" },
  { value: "TENANT_ADMIN", label: "Tenant admin" },
  { value: "RECRUITER", label: "Recruiter" },
];

async function updateUserAccess(userId: string, payload: UserAccessUpdate) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to update user";
    throw new Error(message);
  }

  return (await response.json()) as { user: { updatedAt?: string } };
}

async function createUser(payload: {
  email: string;
  displayName: string;
  role: string;
  tenantRole: string;
}) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to create user";
    throw new Error(message);
  }

  return (await response.json()) as { user: UserAccessListItem | null };
}

async function resetUserPassword(userId: string) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to reset password";
    throw new Error(message);
  }

  return (await response.json()) as { user: { updatedAt?: string } };
}

async function deleteUser(userId: string) {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to delete user";
    throw new Error(message);
  }

  return (await response.json()) as { user: { updatedAt?: string } };
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function resolveRoleOptions(currentRole: string | null) {
  if (!currentRole) {
    return ROLE_OPTIONS;
  }

  const normalized = currentRole.trim().toUpperCase();
  const exists = ROLE_OPTIONS.some((option) => option.value === normalized);

  if (exists) {
    return ROLE_OPTIONS;
  }

  return [{ value: normalized, label: normalized }, ...ROLE_OPTIONS];
}

export function UserAccessPanel({ tenantId, initialUsers }: UserAccessPanelProps) {
  const [users, setUsers] = useState<UserAccessListItem[]>(() => initialUsers);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createState, setCreateState] = useState<{
    email: string;
    displayName: string;
    role: string;
    tenantRole: string;
  }>({
    email: "",
    displayName: "",
    role: USER_ROLES.RECRUITER,
    tenantRole: "RECRUITER",
  });

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users],
  );

  const handleUpdate = useCallback(
    async (userId: string, nextState: Partial<UserAccessListItem>, payload: UserAccessUpdate) => {
      setSavingUserId(userId);
      setError(null);
      setNotice(null);

      const previous = users;
      setUsers((current) => current.map((entry) => (entry.id === userId ? { ...entry, ...nextState } : entry)));

      try {
        const result = await updateUserAccess(userId, payload);
        const updatedAt = result.user.updatedAt ?? new Date().toISOString();

        setUsers((current) =>
          current.map((entry) => (entry.id === userId ? { ...entry, updatedAt } : entry)),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update user";
        setError(message);
        setUsers(previous);
      } finally {
        setSavingUserId(null);
      }
    },
    [users],
  );

  const handleCreate = useCallback(async () => {
    setError(null);
    setNotice(null);
    setSavingUserId("new");

    try {
      const result = await createUser({
        email: createState.email.trim(),
        displayName: createState.displayName.trim(),
        role: createState.role,
        tenantRole: createState.tenantRole,
      });

      if (result.user) {
        setUsers((current) => [...current, result.user as UserAccessListItem]);
        setCreateState({
          email: "",
          displayName: "",
          role: USER_ROLES.RECRUITER,
          tenantRole: "RECRUITER",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create user";
      setError(message);
    } finally {
      setSavingUserId(null);
    }
  }, [createState]);

  const handleResetPassword = useCallback(
    async (userId: string) => {
      setSavingUserId(userId);
      setError(null);
      setNotice(null);

      try {
        const result = await resetUserPassword(userId);
        const updatedAt = result.user.updatedAt ?? new Date().toISOString();

        setUsers((current) =>
          current.map((entry) => (entry.id === userId ? { ...entry, updatedAt } : entry)),
        );
        setNotice("Password reset initiated.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to reset password";
        setError(message);
      } finally {
        setSavingUserId(null);
      }
    },
    [setUsers],
  );

  const handleToggleSuspend = useCallback(
    async (user: UserAccessListItem) => {
      const nextStatus = user.status?.toUpperCase() === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

      await handleUpdate(
        user.id,
        { status: nextStatus, updatedAt: new Date().toISOString() },
        { status: nextStatus },
      );
    },
    [handleUpdate],
  );

  const handleDeleteUser = useCallback(async (user: UserAccessListItem) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete ${user.displayName}? This cannot be undone.`);
      if (!confirmed) return;
    }

    setSavingUserId(user.id);
    setError(null);
    setNotice(null);

    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setNotice("User deleted.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete user";
      setError(message);
    } finally {
      setSavingUserId(null);
    }
  }, []);

  const isCreateDisabled = !createState.email.trim() || !createState.displayName.trim();

  return (
    <ETECard className="gap-6">
      <div className="space-y-2">
        <AdminCardTitle className="text-xl">User access management</AdminCardTitle>
        <p className="text-sm text-zinc-600">
          Permissions are derived from the role assigned to each user. Use tenant access to control workspace membership.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white/60 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Add a user</p>
            <p className="text-sm text-zinc-600">Create a new user for tenant {tenantId}.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</label>
              <input
                value={createState.email}
                onChange={(event) => setCreateState((current) => ({ ...current, email: event.target.value }))}
                placeholder="user@company.com"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Display name</label>
              <input
                value={createState.displayName}
                onChange={(event) => setCreateState((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Display name"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Role</label>
              <select
                value={createState.role}
                onChange={(event) => setCreateState((current) => ({ ...current, role: event.target.value }))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tenant access</label>
              <select
                value={createState.tenantRole}
                onChange={(event) => setCreateState((current) => ({ ...current, tenantRole: event.target.value }))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
              >
                {TENANT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={savingUserId === "new" || isCreateDisabled}
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingUserId === "new" ? "Adding…" : "Add user"}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/60">
        <div className="grid grid-cols-1 gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid-cols-6">
          <span>User</span>
          <span>Role</span>
          <span>Tenant access</span>
          <span>Status</span>
          <span>Last updated</span>
          <span />
        </div>
        <div className="divide-y divide-zinc-200">
          {sortedUsers.map((user) => {
            const isSaving = savingUserId === user.id;
            const roleOptions = resolveRoleOptions(user.role);
            const roleValue = user.role ? user.role.trim().toUpperCase() : USER_ROLES.RECRUITER;
            const tenantRoleValue = user.tenantRole ? user.tenantRole.trim().toUpperCase() : "NONE";
            const statusValue = user.status?.trim().toUpperCase() ?? "ACTIVE";
            const statusLabel = statusValue === "SUSPENDED" ? "Suspended" : "Active";
            const statusTone =
              statusValue === "SUSPENDED"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700";

            return (
              <div
                key={user.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 text-sm text-zinc-700 md:grid-cols-6 md:items-center"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{user.displayName}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <div>
                  <select
                    value={roleValue}
                    onChange={(event) =>
                      handleUpdate(
                        user.id,
                        { role: event.target.value, updatedAt: new Date().toISOString() },
                        { role: event.target.value },
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
                    disabled={isSaving}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={tenantRoleValue}
                    onChange={(event) =>
                      handleUpdate(
                        user.id,
                        { tenantRole: event.target.value, updatedAt: new Date().toISOString() },
                        { tenantRole: event.target.value },
                      )
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm"
                    disabled={isSaving}
                  >
                    {TENANT_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">{formatTimestamp(user.updatedAt)}</div>
                <div className="flex flex-wrap items-center justify-start gap-2 text-xs md:justify-end">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(user.id)}
                    disabled={isSaving}
                    className="text-indigo-600 transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(user)}
                    disabled={isSaving}
                    className="text-amber-700 transition hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {statusValue === "SUSPENDED" ? "Activate" : "Suspend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(user)}
                    disabled={isSaving}
                    className="text-red-600 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                  {isSaving ? <span className="text-xs text-zinc-500">Saving…</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ETECard>
  );
}
