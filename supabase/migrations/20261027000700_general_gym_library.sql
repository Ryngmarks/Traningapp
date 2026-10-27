-- General gym library (owner decision 2026-10-27): more everyday gym
-- exercises, muscle-group categories, and shared global starter templates.
-- Past workouts keep their own category snapshot and are not changed.

-- Move existing global exercises into the new categories.
update public.exercises set category = 'chest' where slug in ('bench_press', 'push_up') and owner_id is null;
update public.exercises set category = 'back' where slug in ('pull_up', 'dumbbell_row') and owner_id is null;
update public.exercises set category = 'shoulders' where slug = 'overhead_press' and owner_id is null;
update public.exercises set category = 'hamstrings' where slug = 'hip_thrust' and owner_id is null;

insert into public.exercises
  (slug, name, category, measurement_type, primary_muscles, secondary_muscles, equipment, instructions)
values
  -- Ben
  ('leg_extension', 'Benspark', 'legs', 'weight_reps',
    '{framsida lår}', '{}', '{maskin}',
    'Sträck benen helt utan att lyfta från sätet. Kontrollerad sänkning.'),
  ('standing_calf_raise', 'Stående vadpress', 'legs', 'weight_reps',
    '{vader}', '{}', '{maskin eller hantlar}',
    'Full rörelse: djupt ner, högt upp och en kort paus i toppen.'),
  -- Baksida och säte
  ('deadlift', 'Marklyft', 'hamstrings', 'weight_reps',
    '{säte,baksida lår,ländrygg}', '{framsida lår,grepp,övre rygg}', '{skivstång}',
    'Stången över mitten av foten, neutral rygg. Tryck ifrån golvet och lås ut med höften.'),
  ('seated_leg_curl', 'Sittande lårcurl', 'hamstrings', 'weight_reps',
    '{baksida lår}', '{vader}', '{maskin}',
    'Böj knäna så långt det går och sänk kontrollerat.'),
  ('cable_kickback', 'Kickback i kabel', 'hamstrings', 'weight_reps',
    '{säte}', '{baksida lår}', '{kabel,fotmanschett}',
    'Sträck benet bakåt med sätet, utan att svanka. Reps per ben.'),
  -- Bröst
  ('db_bench_press', 'Hantelpress', 'chest', 'weight_reps',
    '{bröst}', '{triceps,främre axel}', '{hantlar,bänk}',
    'Skulderbladen ihop, sänk hantlarna kontrollerat till bröstets nivå och pressa upp. Vikt per hantel.'),
  ('incline_db_press', 'Lutande hantelpress', 'chest', 'weight_reps',
    '{övre bröst}', '{främre axel,triceps}', '{hantlar,lutande bänk}',
    'Bänken i 30–45 grader. Pressa upp och lätt inåt. Vikt per hantel.'),
  ('cable_fly', 'Flyes i kabel', 'chest', 'weight_reps',
    '{bröst}', '{främre axel}', '{kabel}',
    'Lätt böjda armbågar, för händerna i en båge framför bröstet.'),
  ('dips', 'Dips', 'chest', 'bodyweight_reps',
    '{bröst,triceps}', '{främre axel}', '{dipsställning}',
    'Sänk tills överarmarna är vågräta, pressa upp. Extra vikt anges i kg.'),
  -- Rygg
  ('lat_pulldown', 'Latsdrag', 'back', 'weight_reps',
    '{latissimus}', '{biceps,övre rygg}', '{kabelmaskin}',
    'Dra stången mot övre bröstet med lätt bakåtlutning. Kontrollerad väg upp.'),
  ('seated_cable_row', 'Sittande kabelrodd', 'back', 'weight_reps',
    '{övre rygg,latissimus}', '{biceps}', '{kabelmaskin}',
    'Rak rygg, dra handtaget mot magen och för ihop skulderbladen.'),
  ('barbell_row', 'Skivstångsrodd', 'back', 'weight_reps',
    '{övre rygg,latissimus}', '{biceps,ländrygg}', '{skivstång}',
    'Fäll fram överkroppen, neutral rygg. Dra stången mot naveln.'),
  ('shrug', 'Shrugs', 'back', 'weight_reps',
    '{trapezius}', '{grepp}', '{hantlar eller skivstång}',
    'Lyft axlarna rakt upp mot öronen, kort paus, sänk kontrollerat.'),
  -- Axlar
  ('db_shoulder_press', 'Axelpress med hantlar', 'shoulders', 'weight_reps',
    '{axlar}', '{triceps}', '{hantlar,bänk}',
    'Sittande eller stående. Pressa hantlarna upp över huvudet. Vikt per hantel.'),
  ('lateral_raise', 'Sidolyft', 'shoulders', 'weight_reps',
    '{sidodelen axel}', '{trapezius}', '{hantlar}',
    'Lyft armarna ut åt sidan till axelhöjd med lätt böjda armbågar. Vikt per hantel.'),
  ('reverse_fly', 'Omvända flyes', 'shoulders', 'weight_reps',
    '{bakre axel}', '{övre rygg}', '{hantlar eller kabel}',
    'Fäll fram och för armarna ut åt sidorna med lätt böjda armbågar.'),
  ('face_pull', 'Face pulls', 'shoulders', 'weight_reps',
    '{bakre axel}', '{övre rygg,rotatorkuff}', '{kabel,rep}',
    'Dra repet mot ansiktet med höga armbågar och rotera ut händerna.'),
  -- Armar
  ('db_biceps_curl', 'Bicepscurl med hantlar', 'arms', 'weight_reps',
    '{biceps}', '{underarmar}', '{hantlar}',
    'Stilla överarmar, curla upp och sänk kontrollerat. Vikt per hantel.'),
  ('hammer_curl', 'Hammercurl', 'arms', 'weight_reps',
    '{biceps,brachialis}', '{underarmar}', '{hantlar}',
    'Neutralt grepp med tummarna uppåt. Vikt per hantel.'),
  ('barbell_curl', 'Skivstångscurl', 'arms', 'weight_reps',
    '{biceps}', '{underarmar}', '{skivstång eller EZ-stång}',
    'Armbågarna intill kroppen, inget gung.'),
  ('triceps_pushdown', 'Triceps pushdown', 'arms', 'weight_reps',
    '{triceps}', '{}', '{kabel}',
    'Armbågarna intill kroppen, sträck armarna helt nedåt.'),
  ('skull_crusher', 'Liggande tricepspress', 'arms', 'weight_reps',
    '{triceps}', '{}', '{EZ-stång eller hantlar,bänk}',
    'Sänk vikten mot pannan genom att bara böja armbågarna, sträck upp.'),
  -- Bål
  ('ab_wheel', 'Magrulle', 'core', 'bodyweight_reps',
    '{raka bukmuskler}', '{latissimus,höftböjare}', '{magrulle}',
    'Rulla ut så långt du kan med neutral ländrygg och rulla tillbaka.'),
  ('cable_crunch', 'Kabelcrunch', 'core', 'weight_reps',
    '{raka bukmuskler}', '{}', '{kabel,rep}',
    'På knä, rulla ihop överkroppen mot höfterna med magen.'),
  -- Kondition
  ('treadmill', 'Löpband', 'conditioning', 'distance',
    '{kondition}', '{ben}', '{löpband}',
    'Distans i meter. Tid kan noteras i anteckningen.'),
  ('cross_trainer', 'Crosstrainer', 'conditioning', 'duration',
    '{kondition}', '{ben,armar}', '{crosstrainer}',
    'Jämnt tempo eller intervaller. Tid per omgång.'),
  ('exercise_bike', 'Motionscykel', 'conditioning', 'duration',
    '{kondition}', '{ben}', '{motionscykel}',
    'Jämnt tempo eller intervaller. Tid per omgång.');

-- ---------------------------------------------------------------------------
-- Global starter templates, shared with every member (read-only; start them
-- directly or copy to change).
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
  t record;
begin
  for t in
    select * from (values
      ('Helkropp A', 'Allsidigt helkroppspass. Bra 2–3 gånger i veckan växelvis med Helkropp B.', 100, array[
        'back_squat:2:3:6:10', 'bench_press:1:3:6:10', 'barbell_row:0:3:8:12',
        'overhead_press:0:3:8:12', 'romanian_deadlift:0:3:8:12', 'plank:0:3:0:0']),
      ('Helkropp B', 'Allsidigt helkroppspass. Kör växelvis med Helkropp A.', 101, array[
        'deadlift:2:3:4:6', 'incline_db_press:0:3:8:12', 'lat_pulldown:0:3:8:12',
        'bulgarian_split_squat:0:3:8:12', 'lateral_raise:0:3:12:15', 'hanging_knee_raise:0:3:10:15']),
      ('Överkropp', 'Bröst, rygg, axlar och armar. Passar ihop med Underkropp.', 102, array[
        'bench_press:1:4:6:10', 'seated_cable_row:0:3:8:12', 'db_shoulder_press:0:3:8:12',
        'pull_up:0:3:6:10', 'db_biceps_curl:0:3:10:15', 'triceps_pushdown:0:3:10:15']),
      ('Underkropp', 'Ben, baksida och säte. Passar ihop med Överkropp.', 103, array[
        'back_squat:2:4:5:8', 'romanian_deadlift:0:3:8:10', 'leg_press:0:3:10:12',
        'leg_extension:0:3:12:15', 'seated_leg_curl:0:3:10:15', 'standing_calf_raise:0:3:10:15'])
    ) as v(name, notes, sort_order, items)
  loop
    insert into public.workout_templates (user_id, name, notes, sort_order)
    values (null, t.name, t.notes, t.sort_order)
    returning id into v_id;

    insert into public.template_exercises (
      template_id, user_id, exercise_id, position, warmup_sets, planned_sets,
      rep_min, rep_max, target_duration_s
    )
    select v_id, null, e.id, item.ord - 1,
           split_part(item.spec, ':', 2)::smallint,
           split_part(item.spec, ':', 3)::smallint,
           nullif(split_part(item.spec, ':', 4), '0')::smallint,
           nullif(split_part(item.spec, ':', 5), '0')::smallint,
           case when e.measurement_type = 'duration' then 40 end
    from unnest(t.items) with ordinality as item(spec, ord)
    join public.exercises e on e.slug = split_part(item.spec, ':', 1) and e.owner_id is null;
  end loop;
end $$;
