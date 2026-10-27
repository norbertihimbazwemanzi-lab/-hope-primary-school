import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getWebsiteSettings, saveWebsiteSettings, getGalleryItems, getStaffMembers, getEnrolledStudents } from './adminStore';

let activeSupabaseClient: SupabaseClient | null = null;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Retrieve current Supabase configuration from environment variables or stored settings
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const settings = getWebsiteSettings();
  const storedUrl = (settings.supabaseUrl || '').trim();
  const storedKey = (settings.supabaseAnonKey || '').trim();

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
  };
};

/**
 * Get or initialize Supabase client
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    activeSupabaseClient = null;
    return null;
  }

  if (
    !activeSupabaseClient ||
    (activeSupabaseClient as any).supabaseUrl !== config.url
  ) {
    try {
      activeSupabaseClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.warn('[Supabase] Client init error:', err);
      activeSupabaseClient = null;
    }
  }
  return activeSupabaseClient;
};

/**
 * Test Supabase connection with credentials
 */
export const testSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string; timestamp?: string }> => {
  const url = (testUrl || getSupabaseConfig().url || '').trim();
  const key = (testKey || getSupabaseConfig().anonKey || '').trim();

  if (!url || !key) {
    return {
      success: false,
      message: 'Supabase Project URL and Anon/Public Key are required to establish connection.',
    };
  }

  if (!url.startsWith('https://')) {
    return {
      success: false,
      message: 'Supabase URL must start with https:// (e.g., https://your-project.supabase.co)',
    };
  }

  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    
    // Quick probe: try fetching from a standard endpoint or public bucket/auth health
    const { error } = await client.from('school_gallery').select('id').limit(1);

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // 42P01 means relation does not exist yet (which is normal before table creation), but connection succeeded!
      if (error.message && error.message.includes('FetchError')) {
        return {
          success: false,
          message: `Network connection failed: ${error.message}. Please check your Supabase Project URL.`,
        };
      }
      if (error.message && error.message.includes('JWT') || error.message.includes('API key')) {
        return {
          success: false,
          message: `Authentication error: ${error.message}. Please verify your anon/public API key.`,
        };
      }
    }

    return {
      success: true,
      message: 'Connected successfully to Supabase! Remote PostgreSQL database endpoint is reachable.',
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
};

/**
 * Sync website data (Gallery, Staff, Settings, Students) to Supabase tables
 */
export const syncAllDataToSupabase = async (
  targetUrl?: string,
  targetKey?: string
): Promise<{
  success: boolean;
  message: string;
  syncedCount: { gallery: number; staff: number; students: number };
}> => {
  let client = getSupabaseClient();
  if (targetUrl && targetKey && targetUrl.trim() && targetKey.trim()) {
    try {
      client = createClient(targetUrl.trim(), targetKey.trim(), {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.warn('[Supabase] Custom client creation failed:', err);
    }
  }

  if (!client) {
    return {
      success: false,
      message: 'Supabase is not configured yet. Please configure your Project URL and Anon Key.',
      syncedCount: { gallery: 0, staff: 0, students: 0 },
    };
  }

  const galleryItems = getGalleryItems();
  const staffMembers = getStaffMembers();
  const students = getEnrolledStudents();

  let galleryCount = 0;
  let staffCount = 0;
  let studentsCount = 0;

  try {
    // 1. Sync Gallery Items to Supabase
    if (galleryItems.length > 0) {
      const { error: galleryErr } = await client
        .from('school_gallery')
        .upsert(
          galleryItems.map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
            description: g.description,
            image_src: g.imageSrc,
            caption: g.caption || g.description,
            alt_text: g.altText || g.title,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      if (!galleryErr) {
        galleryCount = galleryItems.length;
      } else {
        console.warn('[Supabase] Gallery sync table notice:', galleryErr.message);
      }
    }

    // 2. Sync Staff Members
    if (staffMembers.length > 0) {
      const { error: staffErr } = await client
        .from('staff_members')
        .upsert(
          staffMembers.map((s) => ({
            id: s.id,
            name: s.name,
            role: s.role,
            email: s.email,
            phone: s.phone,
            username: s.username,
            assigned_subject_or_grade: s.assignedSubjectOrGrade || '',
            status: s.status,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      if (!staffErr) {
        staffCount = staffMembers.length;
      }
    }

    // 3. Sync Students
    if (students.length > 0) {
      const { error: studentsErr } = await client
        .from('enrolled_students')
        .upsert(
          students.map((st) => ({
            id: st.id,
            full_name: st.fullName,
            reg_number: st.regNumber,
            grade_code: st.gradeCode,
            status: st.status,
            parent_name: st.parentName,
            parent_phone: st.parentPhone,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
      if (!studentsErr) {
        studentsCount = students.length;
      }
    }

    return {
      success: true,
      message: `Supabase database synchronized successfully! (${galleryCount} gallery images, ${staffCount} staff, ${studentsCount} students).`,
      syncedCount: { gallery: galleryCount, staff: staffCount, students: studentsCount },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error syncing data to Supabase: ${err.message || 'Unknown error'}`,
      syncedCount: { gallery: galleryCount, staff: staffCount, students: studentsCount },
    };
  }
};
