import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://ectsdmjzemifbvaahhiv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjdHNkbWp6ZW1pZmJ2YWFoaGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1OTI0ODcsImV4cCI6MjA5ODE2ODQ4N30._rlGyWdBMcXLqYtzhiGOu3aeKF44RjOy3QTPpB71VYM'
)