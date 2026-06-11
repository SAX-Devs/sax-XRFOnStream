import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { signCommand } from "@/lib/hmac/sign";
import { publishToMqtt } from "@/lib/emqx/publish";
import { hasMinimumRole } from "@/constants/roles";
import type { UserRole } from "@/types/auth";

interface CommandBody {
  module: string;
  command: string;
  args?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role + tenant come from the protected user_profiles table (RLS: own row).
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole) ?? "viewer";
  if (!hasMinimumRole(role, "operator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CommandBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.module || !body.command) {
    return NextResponse.json(
      { error: "module and command are required" },
      { status: 400 }
    );
  }

  const tenantId = profile?.tenant_id ?? "";
  const serviceClient = await createServiceClient();

  // Verify device exists and belongs to user's tenant (sax_admin skips tenant check)
  const deviceQuery = serviceClient
    .from("devices")
    .select("id, tenant_id")
    .eq("id", deviceId);

  if (role !== "sax_admin") {
    deviceQuery.eq("tenant_id", tenantId);
  }

  const { data: device } = await deviceQuery.single();

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  // Fetch HMAC secret via Postgres function (see migration 00012_get_device_hmac_secret_fn.sql)
  // The function reads from private.device_secrets with SECURITY DEFINER, callable only by service_role
  // Cast required because the RPC isn't yet in the generated Database types
  const { data: secretHex, error: secretError } = await (
    serviceClient.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: string | null; error: Error | null }>
  )("get_device_hmac_secret", { p_device_id: deviceId });

  if (secretError || !secretHex) {
    return NextResponse.json(
      { error: "Device secret not found" },
      { status: 500 }
    );
  }

  const commandId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);

  const payload: Record<string, unknown> = {
    command_id: commandId,
    device_id: deviceId,
    module: body.module,
    command: body.command,
    args: body.args ?? {},
    ts: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // PostgREST returns BYTEA as hex with \x prefix (e.g. "\xdeadbeef")
  const hex = secretHex.replace(/^\\x/, "");
  const hmacSecret = Buffer.from(hex, "hex");
  payload.signature = signCommand(payload, hmacSecret);

  try {
    await publishToMqtt(
      `sax/${device.tenant_id}/${deviceId}/command/request`,
      payload
    );
  } catch (e) {
    // Log the underlying error server-side for diagnosis, but don't leak it to
    // the client.
    console.error(
      "[commands] publish failed:",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Failed to publish command" },
      { status: 502 }
    );
  }

  await serviceClient.from("command_audit").insert({
    id: commandId,
    device_id: deviceId,
    tenant_id: device.tenant_id,
    issued_by: user.id,
    issued_by_email: user.email ?? "",
    issued_by_role: role,
    module: body.module,
    command: body.command,
    args: body.args ?? null,
    expires_at: expiresAt.toISOString(),
  });

  return NextResponse.json({ command_id: commandId, status: "sent" });
}
