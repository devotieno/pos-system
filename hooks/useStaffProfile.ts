"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { StaffProfile } from "@/types/pos";

export interface UseStaffProfileResult {
  profile: StaffProfile | null;
  loading: boolean;
  /** True once we've checked and there is definitely no staff profile for this account. */
  notFound: boolean;
}

export function useStaffProfile(uid: string | null): UseStaffProfileResult {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(getDb(), "pos_staff", uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as StaffProfile);
          setNotFound(false);
        } else {
          setProfile(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      () => {
        setProfile(null);
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  return { profile, loading, notFound };
}
