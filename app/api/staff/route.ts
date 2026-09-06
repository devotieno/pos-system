import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { MANAGER_ASSIGNABLE_ROLES } from "@/types/pos";
import type { Role } from "@/types/pos";

interface CallerInfo {
  uid: string;
  role: Role;
  locationId: string;
  active?: boolean;
}

/** Verifies the caller's Firebase ID token and loads their staff profile. Throws if either fails. */
async function requireCaller(req: NextRequest): Promise<CallerInfo> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing authorization token.");

  const decoded = await adminAuth().verifyIdToken(token);
  const callerSnap = await adminDb().collection("pos_staff").doc(decoded.uid).get();
  if (!callerSnap.exists) throw new Error("No staff profile found for your account.");

  const caller = callerSnap.data() as { role: Role; locationId: string; active?: boolean };
  if (caller.active === false) throw new Error("Your account has been disabled.");

  return { uid: decoded.uid, role: caller.role, locationId: caller.locationId, active: caller.active };
}

/** Throws unless `caller` is allowed to create/edit a staff member with the given role + location. */
function assertCanAssign(caller: CallerInfo, targetRole: Role, targetLocationId: string): void {
  if (caller.role === "owner") return;
  if (caller.role === "manager") {
    if (!MANAGER_ASSIGNABLE_ROLES.includes(targetRole)) {
      throw new Error("Managers can only add or edit Cashier and Storekeeper accounts.");
    }
    if (targetLocationId !== caller.locationId) {
      throw new Error("Managers can only manage staff at their own store.");
    }
    return;
  }
  throw new Error("You don't have permission to manage staff accounts.");
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await req.json();
    const { name, email, password, role, locationId } = body as {
      name?: string; email?: string; password?: string; role?: Role; locationId?: string;
    };
    if (!name?.trim() || !email?.trim() || !password || !role || !locationId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    assertCanAssign(caller, role, locationId);

    const userRecord = await adminAuth().createUser({ email: email.trim(), password, displayName: name.trim() });
    await adminDb().collection("pos_staff").doc(userRecord.uid).set({
      name: name.trim(), email: email.trim(), role, locationId, active: true,
    });

    return NextResponse.json({ uid: userRecord.uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await req.json();
    const { uid, name, role, locationId, active, password } = body as {
      uid?: string; name?: string; role?: Role; locationId?: string; active?: boolean; password?: string;
    };
    if (!uid) return NextResponse.json({ error: "Missing uid." }, { status: 400 });

    const targetSnap = await adminDb().collection("pos_staff").doc(uid).get();
    if (!targetSnap.exists) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    const target = targetSnap.data() as { role: Role; locationId: string };

    if (caller.role !== "owner") {
      // Can the caller touch this record at all, and (if changing) touch what it's becoming?
      assertCanAssign(caller, target.role, target.locationId);
      assertCanAssign(caller, role ?? target.role, locationId ?? target.locationId);
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (role !== undefined) updates.role = role;
    if (locationId !== undefined) updates.locationId = locationId;
    if (active !== undefined) {
      updates.active = active;
      // Actually lock the account out immediately, not just flip a display flag.
      await adminAuth().updateUser(uid, { disabled: !active });
    }
    if (password) {
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      await adminAuth().updateUser(uid, { password });
    }
    if (Object.keys(updates).length > 0) {
      await adminDb().collection("pos_staff").doc(uid).update(updates);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
