import { getSupabaseClient, isMissingTableError } from './supabaseClient';
import { db } from './firebaseStore';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

export type SmsTableDomain =
  | 'academic_years_terms'
  | 'school_classes_streams'
  | 'school_subjects'
  | 'teacher_assignments'
  | 'exam_config'
  | 'exam_schedules'
  | 'exam_marks'
  | 'lesson_plans'
  | 'learning_materials'
  | 'homework_assignments'
  | 'homework_submissions'
  | 'student_achievements'
  | 'student_notifications'
  | 'class_announcements'
  | 'class_timetables'
  | 'parent_teacher_messages'
  | 'audit_logs'
  | 'fee_structures';

export const fetchSmsDomainFromSupabase = async <T = any>(domain: SmsTableDomain): Promise<T[] | null> => {
  const client = getSupabaseClient();
  if (!client || domain === 'fee_structures') return null;
  try {
    const { data, error } = await client
      .from(domain)
      .select('id, data, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      if (!isMissingTableError(error)) {
        console.warn(`[SMS Supabase] Read ${domain} notice:`, error.message);
      }
      return null;
    }
    if (Array.isArray(data)) {
      return data.map((row: any) => ({
        ...(row.data || {}),
        id: row.id || row.data?.id,
        updatedAt: row.updated_at || row.data?.updatedAt,
      }));
    }
  } catch (err) {
    console.warn(`[SMS Supabase] Read ${domain} failed:`, err);
  }
  return null;
};

export const saveSmsDomainToSupabase = async <T extends { id: string }>(
  domain: SmsTableDomain,
  items: T[]
): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client || domain === 'fee_structures' || items.length === 0) return false;
  try {
    const now = new Date().toISOString();
    const rows = items.map((item) => ({
      id: item.id,
      data: { ...item, updatedAt: (item as any).updatedAt || now },
      updated_at: now,
    }));
    const { error } = await client.from(domain).upsert(rows, { onConflict: 'id' });
    if (!error) return true;
    if (!isMissingTableError(error)) {
      console.warn(`[SMS Supabase] Write ${domain} notice:`, error.message);
    }
  } catch (err) {
    console.warn(`[SMS Supabase] Write ${domain} error:`, err);
  }
  return false;
};

export const fetchSmsDomainFromFirebase = async <T = any>(domain: SmsTableDomain): Promise<T[] | null> => {
  try {
    const colRef = collection(db, `sms_${domain}`);
    const snap = await getDocs(colRef);
    const items: T[] = [];
    snap.forEach((docSnap) => {
      items.push({ ...(docSnap.data() as any), id: docSnap.id });
    });
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
};

export const saveSmsDomainToFirebase = async <T extends { id: string }>(
  domain: SmsTableDomain,
  items: T[]
): Promise<void> => {
  try {
    const colRef = collection(db, `sms_${domain}`);
    const chunk = items.slice(0, 60);
    await Promise.all(
      chunk.map((item) =>
        setDoc(doc(colRef, item.id), {
          ...item,
          updatedAt: new Date().toISOString(),
        })
      )
    );
  } catch {
    // quiet fallback
  }
};

export const subscribeToSmsSupabaseDomain = <T = any>(
  domain: SmsTableDomain,
  callback: (items: T[]) => void
): (() => void) => {
  const client = getSupabaseClient();
  if (!client || domain === 'fee_structures') return () => {};
  try {
    const channel = client
      .channel(`public:${domain}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: domain }, async () => {
        const fresh = await fetchSmsDomainFromSupabase<T>(domain);
        if (fresh) callback(fresh);
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
};
