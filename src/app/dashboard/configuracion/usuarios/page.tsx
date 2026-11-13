"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  getPermissionsForRole,
  type AppRole,
  type RbacPermission,
} from "@/lib/rbac";

interface FarmUserRow {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  createdAt: string;
}

const ASSIGNABLE_ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "operario", label: "Operario de Galpón", hint: "Captura huevos, mortalidad, ración y bioseguridad en campo" },
  { value: "veterinario", label: "Veterinario / Zootecnista", hint: "Registra sanidad, vacunas, pesos y producción" },
  { value: "gerente", label: "Gerente", hint: "Acceso operativo, cierre diario, finanzas y usuarios" },
  { value: "propietario", label: "Propietario", hint: "Control total de la granja y reapertura de cierres" },
];

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as RbacPermission[];

function buildWelcomeMessage(u: { name: string; username: string; role: AppRole }, tempPassword?: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://granja.iwage.co";
  const roleLabel = ROLE_LABELS[u.role] || u.role;
  const roleInfo = ASSIGNABLE_ROLES.find((r) => r.value === u.role)?.hint || "Operación en granja";
  const lines = [
    `Hola ${u.name}, ya tienes acceso a Iwagé Granja.`,
    `• Ingreso: ${origin}/login`,
    `• Usuario: ${u.username}`,
    ...(tempPassword ? [`• Contraseña temporal: ${tempPassword} (cámbiala o guárdala)`] : ["• Contraseña: la asignada por administración"]),
    `• Rol: ${roleLabel} — ${roleInfo}.`,
    `En galpón recuerda usar "Escáner QR" incluso sin señal.`,
  ];
  return lines.join("\n");
}

export default function UsuariosConfiguracionPage() {
  const [usersList, setUsersList] = useState<FarmUserRow[]>([]);
  const [maxUsers, setMaxUsers] = useState(2);
  const [planCode, setPlanCode] = useState("FREEMIUM_SEMILLA");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCredentialNotice, setLastCredentialNotice] = useState<{
    name: string;
    username: string;
    role: AppRole;
    tempPassword?: string;
  } | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("operario");

  const [editingUser, setEditingUser] = useState<FarmUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("operario");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/configuracion/usuarios", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar la lista de usuarios");
        setLoading(false);
        return;
      }
      setUsersList(data.users || []);
      setMaxUsers(Number(data.maxUsers || 2));
      setPlanCode(String(data.planCode || "FREEMIUM_SEMILLA"));
    } catch {
      setError("Error de conexión cargando usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/configuracion/usuarios", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "No se pudo cargar la lista de usuarios");
          return;
        }
        setUsersList(data.users || []);
        setMaxUsers(Number(data.maxUsers || 2));
        setPlanCode(String(data.planCode || "FREEMIUM_SEMILLA"));
      })
      .catch(() => {
        if (active) setError("Error de conexión cargando usuarios");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el usuario");
        setSaving(false);
        return;
      }
      const createdName = name;
      const createdUsername = username;
      const createdPassword = password;
      const createdRole = role;
      setName("");
      setUsername("");
      setPassword("");
      setRole("operario");
      setSuccess(`Usuario ${data.user?.name || ""} creado correctamente.`);
      setLastCredentialNotice({
        name: data.user?.name || createdName,
        username: data.user?.username || createdUsername,
        role: (data.user?.role || createdRole) as AppRole,
        tempPassword: createdPassword,
      });
      await loadUsers();
    } catch {
      setError("Error de conexión al crear usuario");
    } finally {
      setSaving(false);
    }
  }

  async function copyWelcomeMessage(target: { id?: string; name: string; username: string; role: AppRole }, tempPassword?: string) {
    const text = buildWelcomeMessage(target, tempPassword);
    try {
      await navigator.clipboard.writeText(text);
      const marker = target.id || target.username;
      setCopiedId(marker);
      setTimeout(() => setCopiedId((prev) => (prev === marker ? null : prev)), 2500);
    } catch {
      setError("No se pudo copiar al portapapeles en este navegador.");
    }
  }

  function openEditModal(u: FarmUserRow) {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPassword("");
    setError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setError("");
    setSuccess("");
    if (editPassword.length > 0 && editPassword.length < 8) {
      setError("Si asignas una contraseña nueva, debe tener al menos 8 caracteres.");
      return;
    }
    setSavingEdit(true);
    try {
      const payload: Record<string, string> = {
        id: editingUser.id,
        name: editName.trim(),
        role: editRole,
      };
      if (editPassword.length >= 8) {
        payload.password = editPassword;
      }
      const res = await fetch("/api/configuracion/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar el usuario");
        setSavingEdit(false);
        return;
      }
      setSuccess(`Cuenta de ${data.user?.name || editName} actualizada.`);
      if (editPassword.length >= 8) {
        setLastCredentialNotice({
          name: data.user?.name || editName,
          username: editingUser.username,
          role: editRole,
          tempPassword: editPassword,
        });
      }
      setEditingUser(null);
      await loadUsers();
    } catch {
      setError("Error de conexión al guardar cambios");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangeRole(id: string, nextRole: AppRole) {
    setError("");
    setSuccess("");
    const res = await fetch("/api/configuracion/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, role: nextRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar el rol");
      return;
    }
    setSuccess("Rol actualizado.");
    await loadUsers();
  }

  async function handleDeleteUser(id: string, displayName: string) {
    if (!window.confirm(`¿Eliminar el acceso de ${displayName}?`)) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/configuracion/usuarios?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo eliminar");
      return;
    }
    setSuccess("Usuario eliminado.");
    await loadUsers();
  }

  const limitReached = usersList.length >= maxUsers;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/configuracion"
          className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Configuración
        </Link>
        <div className="text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl">
          Cupo: {usersList.length} / {maxUsers} ({planCode})
        </div>
      </div>

      <HeroBanner
        theme="guia"
        icon={<Users className="w-4 h-4 text-amber-200" aria-hidden="true" />}
        title="Usuarios y Roles de la Granja"
        description="Da acceso seguro a tu operario de galpón, veterinario o socio sin compartir contraseñas ni usar comandos."
      />

      {error && (
        <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-sm font-medium text-red-900">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-sm font-medium text-emerald-900 space-y-2">
          <p>{success}</p>
          {lastCredentialNotice && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-emerald-200/80">
              <p className="text-xs text-emerald-900">
                Envía sus credenciales de campo a <strong>{lastCredentialNotice.name}</strong> (@{lastCredentialNotice.username}) por WhatsApp:
              </p>
              <button
                type="button"
                onClick={() => copyWelcomeMessage(lastCredentialNotice, lastCredentialNotice.tempPassword)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 shrink-0"
              >
                {copiedId === lastCredentialNotice.username ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado para WhatsApp
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar mensaje de bienvenida (WhatsApp)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-emerald-700" />
          Agregar integrante al equipo
        </h2>

        {limitReached ? (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              Has alcanzado el límite de <strong>{maxUsers} usuarios activos</strong> de tu plan actual ({planCode}).
            </div>
            <Link
              href="/dashboard/configuracion/plan"
              className="inline-flex items-center justify-center min-h-[48px] px-4 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 shrink-0"
            >
              Ver opciones de plan
            </Link>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Nombre completo</label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Don José Galponero"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Usuario o celular de ingreso</label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: jose_galpon"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Contraseña temporal (mín. 8)</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">Rol en la finca</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900 bg-white"
              >
                {ASSIGNABLE_ROLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-600">
                {ASSIGNABLE_ROLES.find((r) => r.value === role)?.hint}
              </p>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[48px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-base transition disabled:opacity-50"
              >
                {saving ? "Creando acceso..." : "Crear usuario"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-emerald-700" />
          Cuentas activas ({usersList.length})
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Cargando cuentas...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {usersList.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 bg-slate-50/60"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-base">{u.name}</p>
                      <p className="text-xs font-mono text-slate-600">@{u.username}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    aria-label={`Cambiar rol de ${u.name}`}
                    value={u.role}
                    onChange={(e) => handleChangeRole(u.id, e.target.value as AppRole)}
                    className="flex-1 min-w-[160px] min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
                  >
                    {ASSIGNABLE_ROLES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    aria-label={`Editar o restablecer clave de ${u.name}`}
                    title="Editar nombre, rol o contraseña"
                    className="min-h-[48px] px-3 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => copyWelcomeMessage(u)}
                    aria-label={`Copiar bienvenida WhatsApp para ${u.name}`}
                    title="Copiar mensaje de bienvenida (WhatsApp)"
                    className="min-h-[48px] px-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 inline-flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedId === u.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedId === u.id ? "Copiado" : "WhatsApp"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    aria-label={`Eliminar ${u.name}`}
                    className="min-h-[48px] min-w-[48px] px-3 rounded-xl border border-red-200 bg-white text-red-700 hover:bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matriz colapsable de permisos por rol */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setShowMatrix((prev) => !prev)}
          aria-expanded={showMatrix}
          className="w-full min-h-[48px] flex items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-700" />
              Matriz de permisos por rol
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Verifica qué puede registrar y aprobar cada rol. Solo el Propietario puede reabrir un cierre diario auditado.
            </p>
          </div>
          {showMatrix ? (
            <ChevronUp className="w-5 h-5 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600 shrink-0" />
          )}
        </button>

        {showMatrix && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3 font-bold text-slate-800">Acción en campo / oficina</th>
                  {ASSIGNABLE_ROLES.map((item) => (
                    <th key={item.value} className="py-2.5 px-3 font-bold text-slate-800 text-center whitespace-nowrap">
                      {ROLE_LABELS[item.value]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_PERMISSIONS.map((perm) => (
                  <tr key={perm} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {PERMISSION_LABELS[perm]}
                    </td>
                    {ASSIGNABLE_ROLES.map((item) => {
                      const allowed = getPermissionsForRole(item.value).includes(perm);
                      return (
                        <td key={item.value} className="py-2.5 px-3 text-center">
                          {allowed ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                              Sí
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium text-xs">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar / Restablecer contraseña */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Editar cuenta de ${editingUser.name}`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Editar / Restablecer clave</h3>
                <p className="text-xs font-mono text-slate-600">@{editingUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Cerrar modal"
                className="min-h-[48px] min-w-[48px] rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Rol asignado</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AppRole)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900 bg-white"
                >
                  {ASSIGNABLE_ROLES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Nueva contraseña temporal (opcional, mín. 8)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Déjala vacía para mantener la actual"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-400 text-base text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-[48px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-50"
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

