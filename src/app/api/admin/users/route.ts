import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role");

    let query = supabase
      .from("profiles")
      .select(`*, cafes(name)`)
      .neq("role", "customer")
      .neq("role", "super_admin")
      .order("created_at", { ascending: false });

    if (roleFilter) {
      query = query.eq("role", roleFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    const users = (data || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: null as string | null,
      phone: p.phone,
      role: p.role,
      cafe_id: p.cafe_id,
      cafe_name: p.cafes?.name || null,
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    const { data: authUsers } = await supabase.auth.admin.listUsers();

    if (authUsers) {
      const emailMap = new Map(
        authUsers.users.map((u) => [u.id, u.email])
      );
      for (const u of users) {
        u.email = emailMap.get(u.id) || null;
      }
    }

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, full_name, phone, role, cafe_id } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, full_name, role" },
        { status: 400 }
      );
    }

    if (!["cafe_admin", "cashier"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be cafe_admin or cashier" },
        { status: 400 }
      );
    }

    const serviceSupabase = await createServiceSupabase();

    const { data: authData, error: authError } =
      await serviceSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, cafe_id },
      });

    if (authError) throw authError;

    const newUserId = authData.user.id;

    const { error: profileError } = await serviceSupabase
      .from("profiles")
      .update({
        full_name,
        phone: phone || null,
        role,
        cafe_id: cafe_id || null,
        is_active: true,
      })
      .eq("id", newUserId);

    if (profileError) throw profileError;

    const { data: updatedProfile } = await serviceSupabase
      .from("profiles")
      .select("*, cafes(name)")
      .eq("id", newUserId)
      .single();

    return NextResponse.json({
      user: {
        id: newUserId,
        email,
        full_name: updatedProfile?.full_name || full_name,
        phone: updatedProfile?.phone || phone || null,
        role: updatedProfile?.role || role,
        cafe_id: updatedProfile?.cafe_id || cafe_id || null,
        cafe_name: (updatedProfile as any)?.cafes?.name || null,
        is_active: updatedProfile?.is_active ?? true,
        created_at: updatedProfile?.created_at || new Date().toISOString(),
      },
      password,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminProfile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, is_active, new_password } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing required field: user_id" },
        { status: 400 }
      );
    }

    const serviceSupabase = await createServiceSupabase();

    if (is_active !== undefined) {
      const { error } = await serviceSupabase
        .from("profiles")
        .update({ is_active })
        .eq("id", user_id);

      if (error) throw error;
    }

    if (new_password) {
      const { error } = await serviceSupabase.auth.admin.updateUserById(
        user_id,
        { password: new_password }
      );

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}