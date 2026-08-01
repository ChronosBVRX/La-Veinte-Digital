-- Vacation Module Schema
-- Requires: auth.users, public.profiles

-- 1. Versioned vacation rules
CREATE TABLE IF NOT EXISTS vacation_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  regime TEXT NOT NULL CHECK (regime IN ('SEMESTRAL', 'CUATRIMESTRAL', 'EXTRAORDINARIO_V20', 'ESTATUTO')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_document TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  configuration JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Annual calendars
CREATE TABLE IF NOT EXISTS vacation_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  source_name TEXT NOT NULL DEFAULT 'Oficial',
  source_date DATE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(year, version)
);

-- 3. Calendar roles (vacation periods)
CREATE TABLE IF NOT EXISTS vacation_calendar_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES vacation_calendars(id) ON DELETE CASCADE,
  role_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(calendar_id, role_number)
);

-- 4. Mandatory rest days per year
CREATE TABLE IF NOT EXISTS vacation_mandatory_rest_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  source_document TEXT,
  UNIQUE(year, date)
);

-- 5. Per-user vacation profile data (extends profiles)
CREATE TABLE IF NOT EXISTS vacation_profile_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_type TEXT CHECK (contract_type IN ('BASE','CONFIANZA_B','CONFIANZA','CONFIANZA_A_ESTATUTO','TEMPORAL','SUSTITUTO','MEDICO_RESIDENTE','BECADO','OTRO')),
  category TEXT,
  category_code TEXT,
  work_schedule_type TEXT CHECK (work_schedule_type IN ('ORDINARY','ACCUMULATED_WEEKEND_DAY','ACCUMULATED_NIGHT','ROTATING','CUSTOM')),
  shift TEXT,
  adscription TEXT,
  unit TEXT,
  service TEXT,
  entry_date DATE,
  effective_seniority_years INTEGER,
  effective_seniority_fortnights INTEGER,
  effective_seniority_days INTEGER,
  radiological_exposure TEXT CHECK (radiological_exposure IN ('YES','NO','UNSURE')),
  weekly_rest_days INTEGER[] DEFAULT '{5,6}',
  contract_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 6. Saved simulations
CREATE TABLE IF NOT EXISTS vacation_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES vacation_calendars(id),
  rule_version_id TEXT,
  input_snapshot JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Simulation events log
CREATE TABLE IF NOT EXISTS vacation_simulation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES vacation_simulations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE vacation_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_calendar_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_mandatory_rest_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_profile_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_simulation_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Rules: admins can read/write, all authenticated can read published
CREATE POLICY "Everyone can read rules"
  ON vacation_rule_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rules"
  ON vacation_rule_versions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Calendars: all authenticated can read, admins manage
CREATE POLICY "Everyone can read calendars"
  ON vacation_calendars FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage calendars"
  ON vacation_calendars FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Everyone can read calendar roles"
  ON vacation_calendar_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage calendar roles"
  ON vacation_calendar_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Mandatory rest days: everyone can read, admins manage
CREATE POLICY "Everyone can read mandatory rest days"
  ON vacation_mandatory_rest_days FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage mandatory rest days"
  ON vacation_mandatory_rest_days FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profile data: user can only see/update own data
CREATE POLICY "Users can read own vacation profile"
  ON vacation_profile_data FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own vacation profile"
  ON vacation_profile_data FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own vacation profile"
  ON vacation_profile_data FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Simulations: user can only see own simulations
CREATE POLICY "Users can read own simulations"
  ON vacation_simulations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own simulations"
  ON vacation_simulations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own simulations"
  ON vacation_simulations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own simulations"
  ON vacation_simulations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Events: through simulation ownership
CREATE POLICY "Users can read events for own simulations"
  ON vacation_simulation_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM vacation_simulations WHERE id = simulation_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create events for own simulations"
  ON vacation_simulation_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM vacation_simulations WHERE id = simulation_id AND user_id = auth.uid())
  );

-- Insert initial data: 2026 mandatory rest days
INSERT INTO vacation_mandatory_rest_days (year, date, label, source_document) VALUES
  (2026, '2026-01-01', 'Año Nuevo', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-02-02', 'Primer lunes de febrero (Día de la Constitución)', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-03-16', 'Tercer lunes de marzo (Natalicio de Juárez)', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-04-02', 'Jueves de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-04-03', 'Viernes de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-04-04', 'Sábado de Semana Mayor', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-05-01', 'Día del Trabajo', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-05-10', 'Día de la Madre', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-09-15', 'Fiesta Nacional (15 de septiembre)', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-09-16', 'Día de la Independencia', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-11-16', 'Tercer lunes de noviembre (Día de la Revolución)', 'CCT 2025-2027 - Cláusula 46'),
  (2026, '2026-12-25', 'Navidad', 'CCT 2025-2027 - Cláusula 46')
ON CONFLICT (year, date) DO NOTHING;
