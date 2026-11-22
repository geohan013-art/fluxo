alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

update public.subscriptions
set plan = 'pro_max'
where plan = 'sovereign';

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('standard', 'pro', 'business', 'pro_max'));
