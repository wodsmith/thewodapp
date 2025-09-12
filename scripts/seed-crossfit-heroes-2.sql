-- CrossFit Heroes Workouts Seed Script - Part 2
-- Continues from seed-crossfit-heroes.sql with additional Hero workouts
-- Uses existing CrossFit user, team, and Heroes programming track from Part 1

-- Create additional Heroes workouts
INSERT OR IGNORE INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES 

-- Shawn
('wod_shawn', 'Shawn', 'For time:
Run 5 miles

Run in 5-minute intervals, stopping after each to perform 50 squats and 50 push-ups before beginning the next 5-minute run interval.

U.S. Army Captain Shawn G. Hogan, of Salem, New Hampshire, died Oct. 17, 2012. The 28-year-old was fatally injured in a training exercise at Land Between the Lakes National Recreation Area in Golden Pond, Kentucky. He was assigned to Company B, 4th Battalion, 5th Special Forces Group (Airborne) in Fort Campbell.

Hogan is survived by his parents, Richard and Jean; and sister, Nicole.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Foo
('wod_foo', 'Foo', 'For time:
13 bench presses
Then, complete as many rounds and reps as possible in 20 minutes of:
7 chest-to-bar pull-ups
77 double-unders
2 squat clean thrusters
28 sit-ups

♀ 110 lb
♂ 170 lb

Sgt. Gary "Foo" Morales, of the Port St. Lucie County Sheriff''s Office in Florida, died Feb. 28, 2013. Morales, 35, was fatally shot during a traffic stop. The Air Force veteran was employed by the St. Lucie County Sherriff''s Office for 12 years and had just been promoted to Sergeant Deputy.

He is survived by his wife, Holly; daughters, Brooklyn and Jordan; parents, William and Candy; brothers, Brian, Ken and Brad; grandmother, Romanita Rodriguez; and eight nieces and nephews.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Bowen
('wod_bowen', 'Bowen', '3 rounds for time of:
800-meter run
7 deadlifts
10 burpee pull-ups
14 single-arm kettlebell thrusters, 7 each arm
20 box jumps

♀ 185-lb barbell, 35-lb kettlebell, 20-inch box
♂ 275-lb barbell, 53-lb kettlebell, 24-inch box

Captain Jeffrey Bowen, of Alexander, North Carolina, died July 28, 2011. The 37-year-old was a 13-year veteran of the Asheville Fire Department, assigned to Rescue 3. Bowen was fatally injured while fighting a four-alarm fire in a medical building.

He is survived by his wife, Stacey; son, Charlie Ray; and daughters, Robin Parker and Sarah.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Gaza
('wod_gaza', 'Gaza', '5 rounds for time of:
35 kettlebell swings
30 push-ups
25 pull-ups
20 box jumps
1-mile run

♀ 35-lb kettlebell, 24-inch box
♂ 53-lb kettlebell, 30-inch box

Air Force Capt. Lucas "Gaza" Gruenther, 32, of Twain Harte, California, died on January 28, 2013, when his F-16 went down in the Adriatic Sea off the coast of Italy as a result of bad weather. Gruenther was the chief of flight safety for the 31st Fighter Wing at Aviano Base, Italy, at the time of his death.

He is survived by his wife, Cassy; daughter, Serene; parents, Romel Mathias and Joseph Malin; brother and sister-in-law, Alex and Britton; and brother, Chance Hildreth.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Crain
('wod_crain', 'Crain', '2 rounds for time of:
34 push-ups
50-yard sprint
34 deadlifts
50-yard sprint
34 box jumps
50-yard sprint
34 clean and jerk
50-yard sprint
34 burpees
50-yard sprint
34 wall-ball shots
50-yard sprint
34 pull-ups
50-yard sprint

♀ 95-lb deadlift, 24-inch box, 65-lb clean and jerk, 14-lb medicine ball to a 9-foot target
♂ 135-lb deadlift, 24-inch box, 95-lb clean and jerk, 20-lb medicine ball to a 10-foot target

Officer Michael "Freight" Crain, of Beaumont, California, died Feb. 7, 2013, when he was fatally injured by gunfire in an apparent ambush while on patrol. A former U.S. Marine Corps sergeant, the 34-year-old had been with the Riverside Police Department for 11 years, assigned to field operations and the SWAT Team.

He is survived by his wife, Regina; son, Ian; and daughter, Kaitlyn.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Capoot
('wod_capoot', 'Capoot', 'For time:
100 push-ups
Run 800 meters
75 push-ups
Run 1,200 meters
50 push-ups
Run 1,600 meters
25 push-ups
Run 2,000 meters

Officer James Lowell Capoot, of the Vallejo Police Department, died Nov. 17, 2011, in the line of duty while chasing after an armed man suspected of robbing a bank. The 45-year-old, who lived in Vacaville, California, joined the Vallejo Police Department in 1993 and served as a motorcycle officer, motorcycle instructor, driving instructor and SWAT officer. He received two medals of courage, including one life-saving medal, as well as many other department commendations.

Capoot is survived by his wife, Jennifer; three daughters, Jillian, Jamie and Justine; mother, Beverly Sue; brother and sister-in-law, Louie and Susie DeCarlo; and several other family members. He is preceded in death by his father, Lowell Jesse Capoot.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Hall
('wod_hall', 'Hall', '5 rounds for time of:
3 cleans
200-meter sprint
20 kettlebell snatches, 10 each arm

Rest 2 minutes between rounds.

♀ 155-lb barbell, 35-lb kettlebell
♂ 225-lb barbell, 53-lb kettlebell

U.S. Air Force Capt. Ryan P. Hall, of Colorado Springs, Colorado, died Feb. 18, 2012, near Camp Lemonnier, Djibouti, Africa, when his single-engine U-28 aircraft crashed. There were four total fatalities. The 30-year-old was assigned to the 319th Special Operations Squadron, Hurlburt Field, Florida.

Hall is survived by his parents, Dennis and Kliffa; girlfriend, Marianne Vicente; brother and sister-in-law, Brandon and Karin; brother, Damon; grandmothers, Jean Hall and Nayda Nunn; and nieces and nephews, Erika, Natalie, Izabelleh, Evan and Noah.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Servais
('wod_servais', 'Servais', 'For time:
Run 1.5 miles

Then, 8 rounds of:
19 pull-ups
19 push-ups
19 burpees

Then,
400-meter sandbag carry
1-mile farmers carry

♀ Heavy sandbag, 30-lb dumbbells
♂ Heavy sandbag, 45-lb dumbbells

U.S. Air Force Senior Airman Adam Servais, of Onalaska, Wisconsin, died Aug. 19, 2006, in Uruzgan Province, Afghanistan, when his vehicle came under hostile fire. The 23-year-old was assigned to the 23rd Special Tactics Squadron, Hurlburt Field, Florida.

Servais is survived by his parents, Peter and Susan; and sister, Laura.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Tag all workouts as Hero benchmarks
INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES 
-- Shawn workout tags
('wtag_shawn_hero', 'wod_shawn', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_shawn_benchmark', 'wod_shawn', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Foo workout tags
('wtag_foo_hero', 'wod_foo', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_foo_benchmark', 'wod_foo', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Bowen workout tags
('wtag_bowen_hero', 'wod_bowen', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_bowen_benchmark', 'wod_bowen', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Gaza workout tags
('wtag_gaza_hero', 'wod_gaza', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_gaza_benchmark', 'wod_gaza', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Crain workout tags
('wtag_crain_hero', 'wod_crain', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_crain_benchmark', 'wod_crain', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Capoot workout tags
('wtag_capoot_hero', 'wod_capoot', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_capoot_benchmark', 'wod_capoot', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Hall workout tags
('wtag_hall_hero', 'wod_hall', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_hall_benchmark', 'wod_hall', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
-- Servais workout tags
('wtag_servais_hero', 'wod_servais', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_servais_benchmark', 'wod_servais', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Create workout movements relationships (using existing movement IDs from seed.sql)
INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES 
-- Shawn: Run, Squats, Push-ups
('wm_shawn_run', 'wod_shawn', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_shawn_airsquat', 'wod_shawn', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_shawn_pushup', 'wod_shawn', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Foo: Bench press, Chest-to-bar pull-ups, Double-unders, Squat clean thrusters, Sit-ups
('wm_foo_benchpress', 'wod_foo', 'mov_benchpress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_foo_ctbpullup', 'wod_foo', 'mov_ctbpullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_foo_doubleunder', 'wod_foo', 'mov_doubleunder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_foo_thruster', 'wod_foo', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_foo_situp', 'wod_foo', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Bowen: Run, Deadlifts, Burpee pull-ups, Kettlebell thrusters, Box jumps
('wm_bowen_run', 'wod_bowen', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_bowen_deadlift', 'wod_bowen', 'mov_deadlift', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_bowen_pullup', 'wod_bowen', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_bowen_burpee', 'wod_bowen', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_bowen_thruster', 'wod_bowen', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_bowen_boxjump', 'wod_bowen', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Gaza: Kettlebell swings, Push-ups, Pull-ups, Box jumps, Run
('wm_gaza_kbswing', 'wod_gaza', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_gaza_pushup', 'wod_gaza', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_gaza_pullup', 'wod_gaza', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_gaza_boxjump', 'wod_gaza', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_gaza_run', 'wod_gaza', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Crain: Push-ups, Sprint (run), Deadlifts, Box jumps, Clean and jerk, Burpees, Wall-ball shots, Pull-ups
('wm_crain_pushup', 'wod_crain', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_run', 'wod_crain', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_deadlift', 'wod_crain', 'mov_deadlift', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_boxjump', 'wod_crain', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_cleanjerk', 'wod_crain', 'mov_cleanjerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_burpee', 'wod_crain', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_wallball', 'wod_crain', 'mov_wallball', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_crain_pullup', 'wod_crain', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Capoot: Push-ups, Run
('wm_capoot_pushup', 'wod_capoot', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_capoot_run', 'wod_capoot', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Hall: Cleans, Sprint (run), Kettlebell snatches
('wm_hall_clean', 'wod_hall', 'mov_clean', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hall_run', 'wod_hall', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hall_kbswing', 'wod_hall', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Servais: Run, Pull-ups, Push-ups, Burpees (no movements for sandbag/farmers carry in seed)
('wm_servais_run', 'wod_servais', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_servais_pullup', 'wod_servais', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_servais_pushup', 'wod_servais', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_servais_burpee', 'wod_servais', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Add workouts to the Heroes programming track
INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES 
('trwk_heroes_shawn', 'ptrk_heroes', 'wod_shawn', 89, 13, 'Long running with interval squats and push-ups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_foo', 'ptrk_heroes', 'wod_foo', 90, 13, 'Bench press with AMRAP combination work', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_bowen', 'ptrk_heroes', 'wod_bowen', 91, 13, 'Heavy deadlifts with mixed modal work', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_gaza', 'ptrk_heroes', 'wod_gaza', 92, 14, 'High volume endurance with kettlebell work', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_crain', 'ptrk_heroes', 'wod_crain', 93, 14, 'Sprint chipper with varied movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_capoot', 'ptrk_heroes', 'wod_capoot', 94, 14, 'Descending push-ups with progressive running', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_hall', 'ptrk_heroes', 'wod_hall', 95, 14, 'Heavy cleans with kettlebell work and sprints', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_heroes_servais', 'ptrk_heroes', 'wod_servais', 96, 14, 'Long endurance test with carries', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);