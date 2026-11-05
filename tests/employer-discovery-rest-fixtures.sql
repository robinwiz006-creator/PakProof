-- Synthetic opt-ins for real local REST tests. Never applied to hosted data.
insert into auth.users(id,raw_user_meta_data)
select ('a0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('full_name','Directory REST Fixture '||lpad(n::text,2,'0')) from generate_series(10,33) n;
insert into auth.users(id,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000043','{"full_name":"Private Directory Probe"}'),
('a0000000-0000-4000-8000-000000000044','{"full_name":"Undiscoverable Directory Probe"}');
update public.profiles set is_public=true,is_discoverable=true,allow_contact_requests=true,skills=array['React'] where id between 'a0000000-0000-4000-8000-000000000010' and 'a0000000-0000-4000-8000-000000000033';
update public.profiles set is_discoverable=true,skills=array['SecretSkill'] where id='a0000000-0000-4000-8000-000000000043';
update public.profiles set is_public=true where id='a0000000-0000-4000-8000-000000000044';
insert into public.projects(talent_id,title,description,demo_url) values
('a0000000-0000-4000-8000-000000000010','Public Discovery Project','A keyboard-accessible public energy dashboard.','https://example.com/public-project'),
('a0000000-0000-4000-8000-000000000043','Hidden Directory Project','Private evidence that must not enter search.','https://example.com/hidden');

insert into public.projects(talent_id,title,description,demo_url) values
('a0000000-0000-4000-8000-000000000010','Recent unrelated project one','A newer public portfolio item for search-summary ordering.','https://example.com/new-one'),
('a0000000-0000-4000-8000-000000000010','Recent unrelated project two','Another newer public item; matching evidence should still surface.','https://example.com/new-two');
