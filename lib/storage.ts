import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";

export interface StorageResult {
  key: string;
  value: string;
  shared: boolean;
}

export interface StorageListResult {
  keys: string[];
  prefix: string;
  shared: boolean;
}

/**
 * Every key is stored as a Firestore document { value: string } inside one of two
 * collections. "shared" documents are visible to every till/device that points at this
 * Firebase project; "private" documents are namespaced per browser via a random local id.
 */
const SHARED_COLLECTION = "pos_shared_storage";
const PRIVATE_COLLECTION = "pos_private_storage";
const PRIVATE_ID_KEY = "dukabook-pos-device-id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(PRIVATE_ID_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PRIVATE_ID_KEY, id);
  }
  return id;
}

function docId(key: string, shared: boolean): string {
  return shared ? key : `${getDeviceId()}__${key}`;
}

function colName(shared: boolean): string {
  return shared ? SHARED_COLLECTION : PRIVATE_COLLECTION;
}

export const storage = {
  async get(key: string, shared = false): Promise<StorageResult> {
    const ref = doc(getDb(), colName(shared), docId(key, shared));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Key not found: ${key}`);
    const data = snap.data() as { value: string };
    return { key, value: data.value, shared };
  },

  async set(key: string, value: string, shared = false): Promise<StorageResult | null> {
    try {
      const ref = doc(getDb(), colName(shared), docId(key, shared));
      await setDoc(ref, { value, updatedAt: Date.now() });
      return { key, value, shared };
    } catch {
      return null;
    }
  },

  async delete(key: string, shared = false): Promise<{ key: string; deleted: boolean; shared: boolean } | null> {
    try {
      const ref = doc(getDb(), colName(shared), docId(key, shared));
      await deleteDoc(ref);
      return { key, deleted: true, shared };
    } catch {
      return null;
    }
  },

  async list(prefix = "", shared = false): Promise<StorageListResult> {
    const snap = await getDocs(collection(getDb(), colName(shared)));
    const keys = snap.docs
      .map((d) => (shared ? d.id : d.id.split("__").slice(1).join("__")))
      .filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared };
  },
};
