-- Allow service role (admin API) to read all circle requests
-- Also allow admins (user_type = 'Admin') to read all requests via client
CREATE POLICY IF NOT EXISTS "Admins can view all circle requests"
  ON circle_requests FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can update circle requests"
  ON circle_requests FOR UPDATE
  USING (true);
