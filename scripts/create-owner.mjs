/**
 * Run this once, locally, to create the very first Owner/Admin account and seed the initial
 * business data. After that, the owner can add every other staff member from the Users screen
 * in the app itself - you won't need this script again unless you're setting up a fresh
 * Firebase project.
 *
 * Usage:
 *   npm run create-owner
 *
 * Requires .env.local to have both the NEXT_PUBLIC_FIREBASE_* values and the three
 * FIREBASE_ADMIN_* values filled in (see .env.local.example).
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createInterface } from "node:readline/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "\nMissing Firebase Admin credentials in .env.local.\n" +
        "Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY -\n" +
        "see .env.local.example for where to get these from the Firebase console.\n"
    );
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();
  const db = getFirestore();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("\nDukaBook POS - first-time setup\n");

  const shopName = (await rl.question("Shop / main location name (e.g. \"Main Store\"): ")).trim() || "Main Store";
  const ownerName = (await rl.question("Your full name: ")).trim();
  const email = (await rl.question("Your email (used to log in): ")).trim();
  let password = await rl.question("Choose a password (min 6 characters): ");
  while (password.length < 6) {
    password = await rl.question("Too short - choose a password with at least 6 characters: ");
  }
  rl.close();

  const stateRef = db.collection("pos_shared_storage").doc("dukabook-pos-state-v1");
  const existing = await stateRef.get();

  let locationId;
  if (existing.exists) {
    const data = existing.data();
    locationId = data.locations?.[0]?.id;
    if (!locationId) {
      locationId = genId("loc");
      await stateRef.update({ locations: [{ id: locationId, name: shopName }, ...(data.locations ?? [])] });
    }
    console.log(`\nFound existing business data - using location "${data.locations?.[0]?.name ?? shopName}".`);
  } else {
    locationId = genId("loc");
    await stateRef.set({
      locations: [{ id: locationId, name: shopName }],
      products: [],
      sales: [],
      purchases: [],
      stockMovements: [],
      nextInvoiceNo: 1001,
      etims: { connected: false, kraPin: "", deviceId: "" },
    });
    console.log(`\nCreated initial business data with location "${shopName}".`);
  }

  const userRecord = await auth.createUser({ email, password, displayName: ownerName });
  await db.collection("pos_staff").doc(userRecord.uid).set({
    name: ownerName, email, role: "owner", locationId, active: true,
  });

  console.log(`\nDone! Owner account created for ${email}.`);
  console.log("Sign in at your app's login page with that email and password.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message ?? err);
  process.exit(1);
});
