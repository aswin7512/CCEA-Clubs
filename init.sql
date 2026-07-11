-- 1. Create a custom enum for user roles
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'super_admin');
CREATE TYPE chapter_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE member_role AS ENUM ('member', 'volunteer', 'core_team', 'lead', 'faculty_coordinator');
CREATE TYPE event_admission AS ENUM ('auto_accept', 'manual_accept', 'invite_only');
CREATE TYPE custom_field_type AS ENUM ('text', 'paragraph', 'option', 'checklist');

-- 2. Extend the auth.users table by creating a public profile table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  division TEXT,
  prp_code TEXT UNIQUE,
  phone_number TEXT UNIQUE NOT NULL,
  roll_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the Club Chapters table
-- Note: As requested, we dropped the main 'clubs' table and represent clubs entirely through their chapters
CREATE TABLE public.club_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  academic_year TEXT NOT NULL,
  status chapter_status DEFAULT 'pending',
  campus_lead_id UUID REFERENCES public.profiles(id),
  additional_field_label TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create the Club Members table
CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.club_chapters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status chapter_status DEFAULT 'pending',
  role member_role DEFAULT 'member',
  designation TEXT,
  assigned_by UUID REFERENCES public.profiles(id),
  additional_field_value TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, user_id)
);

-- 5. Create Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.club_chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  admission_type event_admission DEFAULT 'auto_accept',
  created_by UUID REFERENCES public.profiles(id),
  is_during_class_hours BOOLEAN DEFAULT false,
  class_hours JSONB, -- stores array like [1, 2, 3] if during class hours
  start_time TIME,
  end_time TIME,
  restrict_to_members BOOLEAN NOT NULL DEFAULT true,
  co_hosts UUID[] NOT NULL DEFAULT '{}',
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Event Custom Fields table (for dynamic forms)
CREATE TABLE public.event_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  field_type custom_field_type NOT NULL,
  field_label TEXT NOT NULL,
  options JSONB, -- stores array of strings for 'option' or 'checklist'
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0
);

-- 7. Create Event Registrations table
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, invited
  is_present BOOLEAN DEFAULT false, -- For non-class hour events
  attended_hours JSONB DEFAULT '[]'::jsonb, -- Array of hours attended, e.g. [1, 2] for class hour events
  group_members JSONB,
  custom_data JSONB, -- Responses to the custom fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 8. Setup Row Level Security (RLS)
-- (We will define detailed policies later, for now we will just enable them)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Temporarily allow all access for rapid prototyping (WARNING: Remove before production)
CREATE POLICY "Allow all operations for authenticated users on profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on chapters" ON public.club_chapters FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on members" ON public.club_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on events" ON public.events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on event_fields" ON public.event_custom_fields FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on event_registrations" ON public.event_registrations FOR ALL USING (auth.role() = 'authenticated');

-- 9. Insert the Core Admin (Super Admin) User
-- We simulate auth user creation, then add to our profiles table
DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Insert into Supabase Auth system
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'makerscemp@gmail.com', crypt('Cemp@1324', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Maker CCEA"}', NOW(), NOW(), '', '', '', ''
    );

    INSERT INTO public.profiles (
        id, email, role, name, department, phone_number
    ) VALUES (
        new_user_id, 'makerscemp@gmail.com', 'super_admin', 'Maker CCEA', 'Admin', '0000000000'
    );
END $$;

-- 10. Add tables for Funding, Clubs Directory and Contact Directory
CREATE TABLE public.funding_overview (
  id SERIAL PRIMARY KEY,
  total_fund BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.funding_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  club_id UUID REFERENCES public.clubs_directory(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.clubs_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  next_activity TEXT,
  activities_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contacts_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.funding_overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on funding_overview" ON public.funding_overview FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on funding_breakdown" ON public.funding_breakdown FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on clubs_directory" ON public.clubs_directory FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users on contacts_directory" ON public.contacts_directory FOR ALL USING (auth.role() = 'authenticated');

-- 11. Helper function for verifying uniqueness of fields prior to signup (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.check_duplicate_profile_fields(
  phone_to_check text, 
  prp_to_check text, 
  email_to_check text DEFAULT NULL
)
RETURNS TABLE (phone_exists boolean, prp_exists boolean, email_exists boolean) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM public.profiles WHERE phone_number = phone_to_check) AS phone_exists,
    EXISTS(SELECT 1 FROM public.profiles WHERE prp_code = prp_to_check AND prp_to_check IS NOT NULL) AS prp_exists,
    EXISTS(SELECT 1 FROM public.profiles WHERE email = email_to_check AND email_to_check IS NOT NULL) AS email_exists;
END;
$$;

-- 12. Trigger function to copy user metadata to profiles table on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name, department, division, prp_code, phone_number, roll_number)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'),
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'department', ''),
    new.raw_user_meta_data->>'division',
    new.raw_user_meta_data->>'prp_code',
    COALESCE(new.raw_user_meta_data->>'phone_number', ''),
    new.raw_user_meta_data->>'roll_number'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Trigger to execute handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Create Event Tasks table (Kanban Board)
CREATE TABLE public.event_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'done'
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on event_tasks" ON public.event_tasks FOR ALL USING (auth.role() = 'authenticated');

-- 15. Create Club Tasks table (Kanban Board for Clubs)
CREATE TABLE public.club_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.club_chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- 'todo', 'processing', 'whats_next'
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.club_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on club_tasks" ON public.club_tasks FOR ALL USING (auth.role() = 'authenticated');

-- 16. Create Club Member Tasks table
CREATE TABLE public.club_member_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.club_chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.club_member_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on club_member_tasks" ON public.club_member_tasks FOR ALL USING (auth.role() = 'authenticated');

-- 17. Create Club Task Completions table
CREATE TABLE public.club_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.club_member_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_visited BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  feedback TEXT,
  visited_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.club_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users on club_task_completions" ON public.club_task_completions FOR ALL USING (auth.role() = 'authenticated');
