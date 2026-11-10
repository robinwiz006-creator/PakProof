\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values ('22000000-0000-4000-8000-000000000001','{"full_name":"History fixture"}'),('22000000-0000-4000-8000-000000000002','{"full_name":"Other fixture"}');
update public.profiles set is_public=true where id='22000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='22000000-0000-4000-8000-000000000001';
insert into public.passport_history(owner_id,kind,organization,title,start_date,end_date,is_public) values(auth.uid(),'education','Fixture institution','Qualification','2020-01-01','2024-01-01',true);
insert into public.passport_history(owner_id,kind,organization,title,start_date,ongoing) values(auth.uid(),'employment','Fixture employer','Role','2024-01-01',true);
do $$ begin
 if (select count(*) from public.passport_history)<>2 then raise exception 'Owner read failed';end if;
 begin insert into public.passport_history(owner_id,kind,organization,title,start_date,ongoing) values('22000000-0000-4000-8000-000000000002','education','X','X',current_date,true);raise exception 'Ownership bypass';exception when insufficient_privilege then null;end;
 begin update public.passport_history set end_date='2010-01-01',ongoing=false;raise exception 'Invalid chronology';exception when check_violation then null;end;
end $$;
update public.passport_history set title='Updated role' where kind='employment';
set local request.jwt.claim.sub='22000000-0000-4000-8000-000000000002';
do $$begin
 if (select count(*) from public.passport_history)<>1 then raise exception 'Private visibility leak';end if;
 update public.passport_history set title='Unauthorized';if found then raise exception 'Unauthorized update';end if;
 delete from public.passport_history;if found then raise exception 'Unauthorized deletion';end if;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if (select count(*) from public.passport_history)<>1 then raise exception 'Anonymous boundary failed';end if;end$$;
reset role;
update public.profiles set is_public=false where id='22000000-0000-4000-8000-000000000001';
set local role anon;
do $$begin if exists(select 1 from public.passport_history) then raise exception 'Private Passport leak';end if;end$$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='22000000-0000-4000-8000-000000000001';
delete from public.passport_history;
do $$begin if exists(select 1 from public.passport_history) then raise exception 'Owner delete failed';end if;end$$;
rollback;
