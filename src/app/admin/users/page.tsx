"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users,
  UserCog,
  UserCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  KeyRound,
  Lock,
} from "lucide-react";
import type { Cafe } from "@/types/database";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface StaffUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "cafe_admin" | "cashier";
  cafe_id: string | null;
  cafe_name: string | null;
  is_active: boolean;
  created_at: string;
}

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default function StaffManagement() {
  const supabase = createClient();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "cashier" as "cafe_admin" | "cashier",
    cafe_id: "",
    password: generatePassword(),
  });
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const fetchCafes = useCallback(async () => {
    const { data } = await supabase
      .from("cafes")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setCafes(data);
  }, [supabase]);

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error("Full name, email, and password are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone || null,
          role: form.role,
          cafe_id: form.cafe_id || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(
        (t) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Staff account created!</span>
            <span className="text-xs text-muted-foreground">
              Email: {data.user.email} | Password: {data.password}
            </span>
          </div>
        ),
        { duration: 8000 }
      );
      setForm((f) => ({
        ...f,
        full_name: "",
        email: "",
        phone: "",
        cafe_id: "",
        password: generatePassword(),
      }));
      setShowPassword(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (staffUser: StaffUser) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: staffUser.id,
          is_active: !staffUser.is_active,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(
        staffUser.is_active
          ? "Staff account deactivated"
          : "Staff account activated"
      );
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Password has been reset");
      setResetModal(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/login`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(form.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      !term ||
      u.full_name.toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term)
    );
  });

  const totalStaff = users.length;
  const cafeAdminCount = users.filter((u) => u.role === "cafe_admin").length;
  const cashierCount = users.filter((u) => u.role === "cashier").length;

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Staff Management
          </h1>
        </div>
<div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="glass-card rounded-xl p-5">
            <div className="h-12 bg-white/[0.03] rounded-lg animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="h-12 bg-white/[0.03] rounded-lg animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="h-12 bg-white/[0.03] rounded-lg animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
        </div>
        <GlassCard className="p-0 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRowSkeleton key={i} cols={6} />
          ))}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Staff Management
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage cafe staff accounts
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/15">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Staff</p>
              <p className="text-xl sm:text-2xl font-bold">{totalStaff}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-secondary/15">
              <UserCog className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cafe Admins</p>
              <p className="text-xl sm:text-2xl font-bold">{cafeAdminCount}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-chart-4/15">
              <UserCheck className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cashiers</p>
              <p className="text-xl sm:text-2xl font-bold">{cashierCount}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Create Staff Form */}
      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Create Staff Account
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Full Name *
            </label>
            <input
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
              placeholder="e.g. john@cafe.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Phone
            </label>
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
              placeholder="e.g. +91 9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Role *
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as "cafe_admin" | "cashier",
                }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
            >
              <option value="cashier">Cashier</option>
              <option value="cafe_admin">Cafe Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Cafe
            </label>
            <select
              value={form.cafe_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, cafe_id: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
            >
              <option value="">No cafe assigned</option>
              {cafes.map((cafe) => (
                <option key={cafe.id} value={cafe.id}>
                  {cafe.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
              Password *
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 pr-9 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-mono min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={copyPassword}
                className="px-3 py-2.5 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors min-h-[44px]"
                title="Copy password"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-chart-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, password: generatePassword() }))
                }
                className="px-3 py-2.5 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors min-h-[44px]"
                title="Generate new password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-4 neon-glow flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 min-h-[44px]"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {creating ? "Creating..." : "Create Staff Account"}
        </button>
      </GlassCard>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
            placeholder="Search by name or email..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-44 px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
        >
          <option value="">All Roles</option>
          <option value="cafe_admin">Cafe Admin</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>

      {/* Staff Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff accounts yet"
          description="Create your first staff member above."
        />
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground hidden md:table-cell">
                    Phone
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground hidden lg:table-cell">
                    Cafe
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left py-3.5 px-4 font-medium text-muted-foreground hidden lg:table-cell">
                    Created
                  </th>
                  <th className="py-3.5 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((staffUser) => {
                  const isExpanded = expandedId === staffUser.id;
                  return (
                    <tr
                      key={staffUser.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : staffUser.id)
                      }
                    >
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {staffUser.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <span className="truncate max-w-[120px] sm:max-w-none">
                            {staffUser.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground hidden sm:table-cell">
                        {staffUser.email || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground hidden md:table-cell">
                        {staffUser.phone || "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            staffUser.role === "cafe_admin"
                              ? "secondary"
                              : "accent"
                          }
                        >
                          {staffUser.role === "cafe_admin"
                            ? "Cafe Admin"
                            : "Cashier"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground hidden lg:table-cell">
                        {staffUser.cafe_name || "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(staffUser);
                          }}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            staffUser.is_active
                              ? "bg-chart-4"
                              : "bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                              staffUser.is_active
                                ? "translate-x-[22px]"
                                : "translate-x-[3px]"
                            )}
                          />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(staffUser.created_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(
                              isExpanded ? null : staffUser.id
                            );
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Actions */}
          {expandedId &&
            (() => {
              const staffUser = users.find(
                (u) => u.id === expandedId
              );
              if (!staffUser) return null;
              return (
                <div className="border-t border-border px-4 py-4 bg-muted/20 animate-slide-in-down">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleToggleActive(staffUser)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors min-h-[40px]"
                    >
                      {staffUser.is_active ? (
                        <>
                          <Lock className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-chart-4" />
                          Activate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setResetModal(staffUser.id);
                        setNewPassword(generatePassword());
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors min-h-[40px]"
                    >
                      <KeyRound className="w-4 h-4" />
                      Reset Password
                    </button>
                    {staffUser.email && (
                      <button
                        onClick={() =>
                          handleSendResetEmail(staffUser.email!)
                        }
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors min-h-[40px]"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Send Reset Email
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>ID: {staffUser.id}</span>
                    {staffUser.cafe_name && (
                      <span>Cafe: {staffUser.cafe_name}</span>
                    )}
                  </div>
                </div>
              );
            })()}
        </GlassCard>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => {
              setResetModal(null);
              setNewPassword("");
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-xl p-6 w-full max-w-md animate-scale-in">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                Reset Password
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set a new password for this staff member.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-mono min-h-[44px]"
                />
                <button
                  onClick={() => setNewPassword(generatePassword())}
                  className="px-3 py-2.5 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleResetPassword(resetModal)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all min-h-[44px]"
                >
                  Update Password
                </button>
                <button
                  onClick={() => {
                    setResetModal(null);
                    setNewPassword("");
                  }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}