"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { StaffProfile, StaffRecord } from "@/types/pos";

export function useStaffDirectory(enabled: boolean): { staff: StaffRecord[]; loading: boolean } {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setStaff([]);
      setLoading(true);
      return;
    }
    const unsub = onSnapshot(collection(getDb(), "pos_staff"), (snap) => {
      setStaff(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as StaffProfile) })));
      setLoading(false);
    });
    return () => unsub();
  }, [enabled]);

  return { staff, loading };
}
