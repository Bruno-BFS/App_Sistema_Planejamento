-- Security-definer functions must only be callable by authenticated users.
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_member(uuid) from anon;
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public;
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from anon;
revoke all on function public.start_focus_session(uuid, uuid) from public;
revoke all on function public.start_focus_session(uuid, uuid) from anon;
revoke all on function public.stop_focus_session(uuid) from public;
revoke all on function public.stop_focus_session(uuid) from anon;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function public.start_focus_session(uuid, uuid) to authenticated;
grant execute on function public.stop_focus_session(uuid) to authenticated;
