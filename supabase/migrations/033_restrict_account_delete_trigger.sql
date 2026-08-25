/*
  Supabase grants function execution to API roles by default. The account
  deletion helper is a trigger-only SECURITY DEFINER function, so no client role
  should be able to invoke it directly. PUBLIC was revoked in migration 032;
  revoke the two Data API roles explicitly as required by Supabase's privilege
  model. Safe to re-run and safe when the same statement was applied manually.
*/

revoke execute
on function public.prepare_account_delete()
from anon, authenticated;
