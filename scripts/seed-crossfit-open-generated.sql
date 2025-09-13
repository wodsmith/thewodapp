
-- Temporarily disable foreign key checks for bulk insert
PRAGMA foreign_keys = OFF;

-- Create Open programming track
INSERT OR IGNORE INTO programming_track (id, name, description, type, ownerTeamId, isPublic, createdAt, updatedAt, updateCounter) VALUES
('ptrk_open', 'Open', 'CrossFit Open workouts', 'official_third_party', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Subscribe CrossFit team to Open programming track
INSERT OR IGNORE INTO team_programming_track (teamId, trackId, isActive, subscribedAt, startDayOffset, createdAt, updatedAt, updateCounter) VALUES
('team_cokkpu1klwo0ulfhl1iwzpvn', 'ptrk_open', 1, CURRENT_TIMESTAMP, 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);


-- Insert missing movements
INSERT OR IGNORE INTO movements (id, name, type, createdAt, updatedAt, updateCounter) VALUES
('mov_barfacingburpee', 'bar-facing burpee', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_barmuscleup', 'bar muscle up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_boxjumpover', 'box jump over', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_boxstepup', 'box step up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_burpeebox', 'burpee box jump over', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_burpeepullup', 'burpee pull up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbboxstepup', 'dumbbell box step up', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbcleanjerk', 'dumbbell clean and jerk', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbohlunge', 'dumbbell overhead lunge', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbpowerclean', 'dumbbell power clean', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbsquat', 'dumbbell squat', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbthruster', 'dumbbell thruster', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_groundtooverhead', 'ground to overhead', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_hangclean', 'hang clean', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_hrpushup', 'hand release push up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_hswalk', 'handstand walk', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ohlunge', 'overhead lunge', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_shouldertooverhead', 'shoulder to overhead', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_shuttlerun', 'shuttle run', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_sqclean', 'squat clean', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_stricthspu', 'strict handstand push up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_targetburpee', 'target burpee', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_wallwalk', 'wall walk', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Insert missing tags
INSERT OR IGNORE INTO spicy_tags (id, name, createdAt, updatedAt, updateCounter) VALUES
('tag_benchmark', 'benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_open', 'open', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create Open workouts
-- Using strftime('%s', 'now') to get Unix timestamp in seconds for proper sorting
INSERT OR IGNORE INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES

-- Open 25.1
('wod_open_25_1', 'Open 25.1', '• As many rounds and reps as possible in 15 minutes of:
• 3 lateral burpees over the dumbbell
3 dumbbell hang clean-to-overheads
• 30-foot walking lunge (2 x 15 feet)
*After completing each round, add 3 reps to the burpees and hang clean-to-overheads.
♀ 35-lb (15-kg) dumbbell
♂ 50-lb (22.5-kg) dumbbell', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 25.2
('wod_open_25_2', 'Open 25.2', '(22.3 repeat)
For time:
• 21 pull-ups
• 42 double-unders
• 21 thrusters (weight 1)
• 18 chest-to-bar pull-ups
• 36 double-unders
• 18 thrusters (weight 2)
• 15 bar muscle-ups
• 30 double-unders
• 15 thrusters (weight 3)
Time cap: 12 minutes
♀ 65, 75, 85 lb (29, 34, 38 kg)
♂ 95, 115, 135 lb (43, 52, 61 kg)', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 25.3
('wod_open_25_3', 'Open 25.3', 'For time:
• 5 wall walks
50-calorie row
• 5 wall walks
• 25 deadlifts
• 5 wall walks
• 25 cleans
• 5 wall walks
• 25 snatches
• 5 wall walks
50-calorie row
Time cap: 20 minutes
♀ 155-lb (70-kg) deadlift, 85-lb (38-kg) clean, 65-lb (29-kg) snatch
♂ 225-lb (102-kg) deadlift, 135-lb (61-kg) clean, 95-lb (43-kg) snatch', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 24.1
('wod_open_24_1', 'Open 24.1', 'For time:
• 21 dumbbell snatches, arm 1
• 21 lateral burpees over dumbbell
• 21 dumbbell snatches, arm 2
• 21 lateral burpees over dumbbell
• 15 dumbbell snatches, arm 1
• 15 lateral burpees over dumbbell
• 15 dumbbell snatches, arm 2
• 15 lateral burpees over dumbbell
• 9 dumbbell snatches, arm 1
• 9 lateral burpees over dumbbell
• 9 dumbbell snatches, arm 2
• 9 lateral burpees over dumbbell
*Time cap: 15 minutes
♀ 35-lb (15-kg) dumbbell
♂ 50-lb (22.5-kg) dumbbell', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 24.2
('wod_open_24_2', 'Open 24.2', '• As many rounds and reps as possible in 20 minutes of:
300-meter row
• 10 deadlifts
• 50 double-unders
♀ 125 lb (56 kg)
♂ 185 lb (83 kg)', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 24.3
('wod_open_24_3', 'Open 24.3', 'All for time:
• 5 rounds of:
• 10 thrusters, weight 1
• 10 chest-to-bar pull-ups
Rest 1 minute, then:
• 5 rounds of:
• 7 thrusters, weight 2
• 7 bar muscle-ups
Time cap: 15 minutes
♀ 65, 95 lb (29, 43 kg)
♂ 95, 135 lb (43, 61 kg)', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 23.1
('wod_open_23_1', 'Open 23.1', '• Complete as many reps as possible in 14 minutes of:
60-calorie row
• 50 toes-to-bars
• 40 wall-ball shots
• 30 cleans
• 20 muscle-ups
♀ 14-lb ball to 9-ft target, 95-lb cleans
♂ 20-lb ball to 10-ft target, 135-lb cleans', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 23.2A
('wod_open_23_2a', 'Open 23.2A', '• Complete as many reps as possible in 15 minutes of:
• 5 burpee pull-ups
10 shuttle runs (1 rep = 25 ft out/25 ft back)
*Add 5 burpee pull-ups after each round.', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 23.2B
('wod_open_23_2b', 'Open 23.2B', 'Immediately following 23.2A, athletes will have 5 minutes to establish:
1-rep-max thruster (from the floor)', 'load', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 23.3
('wod_open_23_3', 'Open 23.3', '• Starting with a 6-minute time cap, complete as many reps as possible of:
• 5 wall walks
• 50 double-unders
• 15 snatches (weight 1)
• 5 wall walks
• 50 double-unders
• 12 snatches (weight 2)
*If completed before the 6-minute time cap, add 3 minutes to the time cap and complete:
• 20 strict handstand push-ups
• 50 double-unders
• 9 snatches (weight 3)
*If completed before the 9-minute time cap, add 3 minutes to the time cap and complete:
• 20 strict handstand push-ups
• 50 double-unders
• 6 snatches (weight 4)
♀ 65 lb, 95 lb, 125 lb, 155 lb
♂ 95 lb, 135 lb, 185 lb, 225 lb', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 22.1
('wod_open_22_1', 'Open 22.1', '• Complete as many rounds as possible in 15 minutes of:
• 3 wall walks
• 12 dumbbell snatches
• 15 box jump-overs
• 35-lb dumbbell, 20-in box', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 22.2
('wod_open_22_2', 'Open 22.2', '• 1-2-3-4-5-6-7-8-9-10-9-8-7-6-5-4-3-2-1 reps for time of:
• Deadlifts
• Bar-facing burpees
155-lb barbell
Time cap: 10 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 22.3
('wod_open_22_3', 'Open 22.3', 'For time:
• 21 pull-ups
• 42 double-unders
• 21 thrusters (weight 1)
• 18 chest-to-bar pull-ups
• 36 double-unders
• 18 thrusters (weight 2)
• 15 bar muscle-ups
• 30 double-unders
• 15 thrusters (weight 3)
65 lb, then 75 lb, then 85 lb
Time cap: 12 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 21.1
('wod_open_21_1', 'Open 21.1', 'For time:
• 1 wall walk
• 10 double-unders
• 3 wall walks
• 30 double-unders
• 6 wall walks
• 60 double-unders
• 9 wall walks
• 90 double-unders
• 15 wall walks
• 150 double-unders
• 21 wall walks
• 210 double-unders
Time cap: 15 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 21.2
('wod_open_21_2', 'Open 21.2', 'For time:
• 10 dumbbell snatches
• 15 burpee box jump-overs
• 20 dumbbell snatches
• 15 burpee box jump-overs
• 30 dumbbell snatches
• 15 burpee box jump-overs
• 40 dumbbell snatches
• 15 burpee box jump-overs
• 50 dumbbell snatches
• 15 burpee box jump-overs
• 35-lb. dumbbell, 20-in. box
Time cap: 20 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 21.3
('wod_open_21_3', 'Open 21.3', 'For total time:
• 15 front squats
• 30 toes-to-bars
• 15 thrusters
Then, rest 1 minute before continuing with:
• 15 front squats
• 30 chest-to-bar pull-ups
• 15 thrusters
Then, rest 1 minute before continuing with:
• 15 front squats
• 30 bar muscle-ups
• 15 thrusters

• 65 lb. for the front squats and thrusters
Time cap: 15 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 21.4
('wod_open_21_4', 'Open 21.4', 'Complete the following complex for max load:
1 deadlift
1 clean
1 hang clean
1 jerk
Time begins immediately following the completion of 21.3.
Time cap: 7 min.', 'load', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 20.1
('wod_open_20_1', 'Open 20.1', '• 10 rounds for time of:
8 ground-to-overheads, 65 lb.
• 10 bar-facing burpees
Time cap: 15 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 20.2
('wod_open_20_2', 'Open 20.2', '• Complete as many rounds as possible in 20 minutes of:
• 4 dumbbell thrusters
• 6 toes-to-bars
• 24 double-unders
35-lb. dumbbells', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 20.3
('wod_open_20_3', 'Open 20.3', 'For time:
• 21 deadlifts, 155 lb.
• 21 handstand push-ups
• 15 deadlifts, 155 lb.
• 15 handstand push-ups
• 9 deadlifts, 155 lb.
• 9 handstand push-ups
• 21 deadlifts, 205 lb.
50-ft. handstand walk
• 15 deadlifts, 205 lb.
50-ft. handstand walk
• 9 deadlifts, 205 lb.
50-ft. handstand walk
Time cap: 9 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 20.4
('wod_open_20_4', 'Open 20.4', 'For time:
• 30 box jumps, 20 in.
15 clean and jerks, 65 lb.
• 30 box jumps, 20 in.
15 clean and jerks, 85 lb.
• 30 box jumps, 20 in.
10 clean and jerks, 115 lb.
• 30 single-leg squats
10 clean and jerks, 145 lb.
• 30 single-leg squats
5 clean and jerks, 175 lb.
• 30 single-leg squats
5 clean and jerks, 205 lb.
Time cap: 20 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 20.5
('wod_open_20_5', 'Open 20.5', 'For time, partitioned any way:
• 40 muscle-ups
80-cal. row
• 120 wall-ball shots, 14-lb. ball to 9 ft.
Time cap: 20 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 19.1
('wod_open_19_1', 'Open 19.1', '• Complete as many rounds as possible in 15 minutes of:
• 19 wall-ball shots
19-cal. row
Women throw 14-lb. ball to 9-ft. target', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 19.2
('wod_open_19_2', 'Open 19.2', '• Beginning on an 8-minute clock, complete as many reps as possible of:
• 25 toes-to-bars
• 50 double-unders
• 15 squat cleans, 85 lb.
• 25 toes-to-bars
• 50 double-unders
• 13 squat cleans, 115 lb.
If completed before 8 minutes, add 4 minutes to the clock and proceed to:
• 25 toes-to-bars
• 50 double-unders
• 11 squat cleans, 145 lb.
If completed before 12 minutes, add 4 minutes to the clock and proceed to:
• 25 toes-to-bars
• 50 double-unders
• 9 squat cleans, 175 lb.
If completed before 16 minutes, add 4 minutes to the clock and proceed to:
• 25 toes-to-bars
• 50 double-unders
• 7 squat cleans, 205 lb.
Stop at 20 minutes.', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 19.3
('wod_open_19_3', 'Open 19.3', 'For time:
200-ft. dumbbell overhead lunge
• 50 dumbbell box step-ups
• 50 strict handstand push-ups
200-ft. handstand walk
• 35-lb. dumbbell, 20-in. box
Time cap: 10 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 19.4
('wod_open_19_4', 'Open 19.4', 'For total time:
• 3 rounds of:
• 10 snatches
• 12 bar-facing burpees
Then, rest 3 minutes before continuing with:
• 3 rounds of:
• 10 bar muscle-ups
• 12 bar-facing burpees
Women snatch 65 lb.
Time cap: 12 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 19.5
('wod_open_19_5', 'Open 19.5', '• 33-27-21-15-9 reps for time of:
• 65-lb. thrusters
• Chest-to-bar pull-ups
Time cap: 20 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 18.1
('wod_open_18_1', 'Open 18.1', '• Complete as many rounds as possible in 20 minutes of:
• 8 toes-to-bars
10 dumbbell hang clean and jerks
12-cal. row
Men use 50-lb. dumbbell
Women use 35-lb. dumbbell', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 18.2
('wod_open_18_2', 'Open 18.2', '• 1-2-3-4-5-6-7-8-9-10 reps for time of:
• Dumbbell squats
• Bar-facing burpees
Women use 35-lb. dumbbells
Men use 50-lb. dumbbell', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 18.3
('wod_open_18_3', 'Open 18.3', '• 2 rounds for time of:
• 100 double-unders
• 20 overhead squats
• 100 double-unders
• 12 ring muscle-ups
• 100 double-unders
• 20 dumbbell snatches
• 100 double-unders
• 12 bar muscle-ups
• Men perform 115-lb. OHS, 50-lb. DB snatches
• Women perform 80-lb. OHS, 35-lb. DB snatches
Time cap: 14 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 18.4
('wod_open_18_4', 'Open 18.4', '**For time:**
• 21 deadlifts, 225 lb.
• 21 handstand push-ups
• 15 deadlifts, 225 lb.
• 15 handstand push-ups
• 9 deadlifts, 225 lb.
• 9 handstand push-ups
• 21 deadlifts, 315 lb.
50-ft. handstand walk
• 15 deadlifts, 315 lb.
50-ft. handstand walk
• 9 deadlifts, 315 lb.
50-ft. handstand walk
Time cap: 9 min.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 18.5
('wod_open_18_5', 'Open 18.5', '**7 Min AMRAP**
• 3-6-9-… thrusters 100 lbs
• 3-6-9-… chest-to-bar pull-ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 17.1
('wod_open_17_1', 'Open 17.1', '**For Time**
10 Dumbbell Snatch 50/35 lbs
• 15 Burpee Box Jump Overs 24/20?
20 Dumbbell Snatch 50/35 lbs
• 15 Burpee Box Jump Overs 24/20?
30 Dumbbell Snatch 50/35 lbs
• 15 Burpee Box Jump Overs 24/20?
40 Dumbbell Snatch 50/35 lbs
• 15 Burpee Box Jump Overs 24/20?
50 Dumbbell Snatch 50/35 lbs
• 15 Burpee Box Jump Overs 24/20?', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 17.2
('wod_open_17_2', 'Open 17.2', '**12 Min AMRAP**
**2 Rounds of:**
• 50 feet Dumbbell Walking Lunges 2?50/35 lbs
16 Toes to Bars
• 8 Dumbbell Power Cleans 2?50/35 lbs
**2 Rounds of:**
• 50 feet Dumbbell Walking Lunges 2?50/35 lbs
16 Bar Muscle Ups
• 8 Dumbbell Power Cleans 2?50/35 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 17.3
('wod_open_17_3', 'Open 17.3', '**Prior to 8:00, complete:**
**3 rounds of:**
6 Chest to Bar Pull Ups
• 6 Squat Snatches 95/65 lbs
**Then, 3 rounds of:**
7 Chest to Bar Pull Ups
• 5 Squat Snatches 135/95 lbs
**Prior to 12:00, complete 3 rounds of:**
8 Chest to Bar Pull Ups
• 4 Squat Snatches 185/135 lbs
**Same rules applies to other rounds, +4 minutes if you finish 3 rounds, +1 C2B and -1 Squat Snatch, weight goes up to 225/155, 245/175 and 265/185 lbs**', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 17.4
('wod_open_17_4', 'Open 17.4', '**13 Min AMRAP**
• 55 Deadlifts 225/155 lbs
• 55 Wall Balls 20/14 lbs
55 cal Row
55 HSPU', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 17.5
('wod_open_17_5', 'Open 17.5', '**10 Rounds of**
• 9 Thrusters 95/65 lbs
35 DUs', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 16.1
('wod_open_16_1', 'Open 16.1', '**20 Min AMRAP**
25-ft. Overhead Walking Lunges 95/65 lbs
• 8 Bar Facing Burpees
25-ft. Overhead Walking Lunges 95/65 lbs
8 Chest-to-Bar Pull Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 16.2
('wod_open_16_2', 'Open 16.2', '**4 Min Time Cap for**
• 25 Toes-to-Bars
• 50 Double-Unders
• 15 Squat Cleans 135/85 lbs
**If you finish before 4:00, add 4 minutes and continue:**
• 25 TTB + 50 DUs + 13 Sq Cleans 185/115
**Same rule applies for other rounds +4 minutes and decreased reps on squat cleans with increased weight**
• 25 TTB + 50 DUs + 11 Sq Cleans 225/145 lbs
• 25 TTB + 50 DUs + 9 Sq Cleans 275/175 lbs
• 25 TTB + 50 DUs + 7 Sq Cleans 315/205 lbs', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 16.3
('wod_open_16_3', 'Open 16.3', '**7 Min AMRAP**
• 10 Power Snatches 75/55 lbs
3 Bar Muscle Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 16.4
('wod_open_16_4', 'Open 16.4', '**13 Min AMRAP**
• 55 Deadlifts 225/155 lbs
• 55 Wall Balls 20/14 lbs
55 cal Row
55 HSPU', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 16.5
('wod_open_16_5', 'Open 16.5', '**For Time**
**21-18-15-12-9-6-3**
• Thrusters 95/65 lbs
• Bar Facing Burpees', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 15.1
('wod_open_15_1', 'Open 15.1', '**Part A: 9 Min AMRAP**
• 15 Toes-to-Bars
• 10 Deadlifts 115/75 lbs
• 5 Snatches 115/75 lbs
**Part B: 6 Minutes for**
1 RM Clean and Jerk', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 15.2
('wod_open_15_2', 'Open 15.2', '**From 0:00 to 3:00**
**2 Rounds of**
• 10 Overhead Squats 95/65 lbs
10 Chest-to-Bar Pull Ups
**From 3:00 to 6:00**
**2 Rounds of**
• 12 Overhead Squats 95/65 lbs
12 Chest-to-Bar Pull Ups
**From 6:00 to 9:00**
**2 Rounds of**
• 14 Overhead Squats 95/65 lbs
14 Chest-to-Bar Pull Ups
**Etc., following same pattern until you fail to complete both rounds**', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 15.3
('wod_open_15_3', 'Open 15.3', '**14 Min AMRAP**
7 Muscle Ups
• 50 Wall Balls 20/14 lbs
100 DUs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 15.4
('wod_open_15_4', 'Open 15.4', '**8 Min AMRAP**
3-6-9-12-15-18-21-… HSPU
• 3-3-3-6-6-6-9-… Cleans 185/125 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 15.5
('wod_open_15_5', 'Open 15.5', '**For Time**
**27-21-15-9**
• Row (calories)
• Thrusters 95/65 lbs', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 14.1
('wod_open_14_1', 'Open 14.1', '**10 Min AMRAP**
30 DUs
• 15 Power Snatches 75/55 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 14.2
('wod_open_14_2', 'Open 14.2', '**From 0:00 to 3:00**
**2 Rounds of**
• 10 Overhead Squats 95/65 lbs
10 Chest-to-Bar Pull Ups
**From 3:00 to 6:00**
**2 Rounds of**
• 12 Overhead Squats 95/65 lbs
12 Chest-to-Bar Pull Ups
**From 6:00 to 9:00**
**2 Rounds of**
• 14 Overhead Squats 95/65 lbs
14 Chest-to-Bar Pull Ups
**Etc., following same pattern until you fail to complete both rounds**', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 14.3
('wod_open_14_3', 'Open 14.3', '**8 Min Time Cap**
• 10 Deadlifts 135/95 lbs
• 15 Box Jumps 24/20?
• 15 Deadlifts 185/135 lbs
• 15 Box Jumps 24/20?
• 20 Deadlifts 225/155 lbs
• 15 Box Jumps 24/20?
• 25 Deadlifts 275/185 lbs
• 15 Box Jumps 24/20?
• 30 Deadlifts 315/250 lbs
• 15 Box Jumps 24/20?
• 35 Deadlifts 365/225 lbs
• 15 Box Jumps 24/20?', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 14.4
('wod_open_14_4', 'Open 14.4', '**14 Min AMRAP**
60 cal Row
• 50 Toes-to-Bars
• 40 Wall Balls 20/14 lbs
• 30 Cleans 135/95 lbs
20 Muscle Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 14.5
('wod_open_14_5', 'Open 14.5', '**For Time**
**21-18-15-12-9-6-3**
• Thrusters 95/65 lbs
• Bar Facing Burpees', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 13.1
('wod_open_13_1', 'Open 13.1', '**17 Min AMRAP**
• 40 Target Burpees
• 30 Snatches 75/45 lbs
• 30 Target Burpees
• 30 Snatches 135/75 lbs
• 20 Target Burpees
• 30 Snatches 165/100 lbs
• 10 Target Burpees
• Max Snatches 210/120 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 13.2
('wod_open_13_2', 'Open 13.2', '**10 Min AMRAP**
5 Shoulder-to-Overhead 115/75 lbs
• 10 Deadlifts 115/75 lbs
• 15 Box Jumps 24/20?', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 13.3
('wod_open_13_3', 'Open 13.3', '**12 Min AMRAP**
• 150 Wall Balls 20/14 lbs
90 DUs
30 Muscle Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 13.4
('wod_open_13_4', 'Open 13.4', '**7 Min AMRAP**
**3-6-9-12-…**
Clean and Jerks 135/95 lbs
• Toes-to-Bars', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 13.5
('wod_open_13_5', 'Open 13.5', '**4 Min AMRAP**
• 15 Thrusters 100/65 lbs
15 Chest-to-Bar Pull Ups
**Time extends by 4 minutes for each 3 completed rounds**', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 12.1
('wod_open_12_1', 'Open 12.1', '**7 Min AMRAP**
• Target Burpees', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 12.2
('wod_open_12_2', 'Open 12.2', '**10 Min AMRAP**
• 30 Snatches 75/45 lbs
• 30 Snatches 135/75 lbs
• 30 Snatches 165/100 lbs
• Max Snatches 210/120 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 12.3
('wod_open_12_3', 'Open 12.3', '**18 Min AMRAP**
• 15 Box Jumps 24/20?
12 Push Presses 115/75
• 9 Toes-to-Bars', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 12.4
('wod_open_12_4', 'Open 12.4', '**12 Min AMRAP**
• 150 Wall Balls 20/14 lbs
90 DUs
30 Muscle Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 12.5
('wod_open_12_5', 'Open 12.5', '**7 Min AMRAP**
**3-6-9-12-15-…**
• Thrusters 100/65 lbs
Chest-to-Bar Pull Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.1
('wod_open_11_1', 'Open 11.1', '**10 Min AMRAP**
30 DUs
• 15 Power Snatches 75/55 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.2
('wod_open_11_2', 'Open 11.2', '**15 Min AMRAP**
• 9 Deadlifts 155/100 lbs
12 HR Push Ups
• 15 Box Jumps 24/20?', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.3
('wod_open_11_3', 'Open 11.3', '**5 Min AMRAP**
Squat Clean 165/110 lbs
Jerk 165/110 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.4
('wod_open_11_4', 'Open 11.4', '**10 Min AMRAP**
• 60 Bar Facing Burpees
• 30 Overhead Squats 120/90 lbs
10 Muscle Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.5
('wod_open_11_5', 'Open 11.5', '**20 Min AMRAP**
• 5 Power Cleans 145/100 lbs
• 10 Toes-to-Bars
• 15 Wall Balls 20/14 lbs', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Open 11.6
('wod_open_11_6', 'Open 11.6', '**7 Min AMRAP**
**3-6-9-12-15-…**
• Thrusters 100/65 lbs
Chest-to-Bar Pull Ups', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Tag all workouts as Open benchmarks
INSERT OR IGNORE INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES
('wtag_open_25_1_open', 'wod_open_25_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_25_1_benchmark', 'wod_open_25_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_25_2_open', 'wod_open_25_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_25_2_benchmark', 'wod_open_25_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_25_3_open', 'wod_open_25_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_25_3_benchmark', 'wod_open_25_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_1_open', 'wod_open_24_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_1_benchmark', 'wod_open_24_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_2_open', 'wod_open_24_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_2_benchmark', 'wod_open_24_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_3_open', 'wod_open_24_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_24_3_benchmark', 'wod_open_24_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_1_open', 'wod_open_23_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_1_benchmark', 'wod_open_23_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_2a_open', 'wod_open_23_2a', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_2a_benchmark', 'wod_open_23_2a', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_2b_open', 'wod_open_23_2b', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_2b_benchmark', 'wod_open_23_2b', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_3_open', 'wod_open_23_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_23_3_benchmark', 'wod_open_23_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_1_open', 'wod_open_22_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_1_benchmark', 'wod_open_22_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_2_open', 'wod_open_22_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_2_benchmark', 'wod_open_22_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_3_open', 'wod_open_22_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_22_3_benchmark', 'wod_open_22_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_1_open', 'wod_open_21_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_1_benchmark', 'wod_open_21_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_2_open', 'wod_open_21_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_2_benchmark', 'wod_open_21_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_3_open', 'wod_open_21_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_3_benchmark', 'wod_open_21_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_4_open', 'wod_open_21_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_21_4_benchmark', 'wod_open_21_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_1_open', 'wod_open_20_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_1_benchmark', 'wod_open_20_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_2_open', 'wod_open_20_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_2_benchmark', 'wod_open_20_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_3_open', 'wod_open_20_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_3_benchmark', 'wod_open_20_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_4_open', 'wod_open_20_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_4_benchmark', 'wod_open_20_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_5_open', 'wod_open_20_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_20_5_benchmark', 'wod_open_20_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_1_open', 'wod_open_19_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_1_benchmark', 'wod_open_19_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_2_open', 'wod_open_19_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_2_benchmark', 'wod_open_19_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_3_open', 'wod_open_19_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_3_benchmark', 'wod_open_19_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_4_open', 'wod_open_19_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_4_benchmark', 'wod_open_19_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_5_open', 'wod_open_19_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_19_5_benchmark', 'wod_open_19_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_1_open', 'wod_open_18_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_1_benchmark', 'wod_open_18_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_2_open', 'wod_open_18_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_2_benchmark', 'wod_open_18_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_3_open', 'wod_open_18_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_3_benchmark', 'wod_open_18_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_4_open', 'wod_open_18_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_4_benchmark', 'wod_open_18_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_5_open', 'wod_open_18_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_18_5_benchmark', 'wod_open_18_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_1_open', 'wod_open_17_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_1_benchmark', 'wod_open_17_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_2_open', 'wod_open_17_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_2_benchmark', 'wod_open_17_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_3_open', 'wod_open_17_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_3_benchmark', 'wod_open_17_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_4_open', 'wod_open_17_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_4_benchmark', 'wod_open_17_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_5_open', 'wod_open_17_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_17_5_benchmark', 'wod_open_17_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_1_open', 'wod_open_16_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_1_benchmark', 'wod_open_16_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_2_open', 'wod_open_16_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_2_benchmark', 'wod_open_16_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_3_open', 'wod_open_16_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_3_benchmark', 'wod_open_16_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_4_open', 'wod_open_16_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_4_benchmark', 'wod_open_16_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_5_open', 'wod_open_16_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_16_5_benchmark', 'wod_open_16_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_1_open', 'wod_open_15_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_1_benchmark', 'wod_open_15_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_2_open', 'wod_open_15_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_2_benchmark', 'wod_open_15_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_3_open', 'wod_open_15_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_3_benchmark', 'wod_open_15_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_4_open', 'wod_open_15_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_4_benchmark', 'wod_open_15_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_5_open', 'wod_open_15_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_15_5_benchmark', 'wod_open_15_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_1_open', 'wod_open_14_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_1_benchmark', 'wod_open_14_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_2_open', 'wod_open_14_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_2_benchmark', 'wod_open_14_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_3_open', 'wod_open_14_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_3_benchmark', 'wod_open_14_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_4_open', 'wod_open_14_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_4_benchmark', 'wod_open_14_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_5_open', 'wod_open_14_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_14_5_benchmark', 'wod_open_14_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_1_open', 'wod_open_13_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_1_benchmark', 'wod_open_13_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_2_open', 'wod_open_13_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_2_benchmark', 'wod_open_13_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_3_open', 'wod_open_13_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_3_benchmark', 'wod_open_13_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_4_open', 'wod_open_13_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_4_benchmark', 'wod_open_13_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_5_open', 'wod_open_13_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_13_5_benchmark', 'wod_open_13_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_1_open', 'wod_open_12_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_1_benchmark', 'wod_open_12_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_2_open', 'wod_open_12_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_2_benchmark', 'wod_open_12_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_3_open', 'wod_open_12_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_3_benchmark', 'wod_open_12_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_4_open', 'wod_open_12_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_4_benchmark', 'wod_open_12_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_5_open', 'wod_open_12_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_12_5_benchmark', 'wod_open_12_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_1_open', 'wod_open_11_1', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_1_benchmark', 'wod_open_11_1', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_2_open', 'wod_open_11_2', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_2_benchmark', 'wod_open_11_2', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_3_open', 'wod_open_11_3', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_3_benchmark', 'wod_open_11_3', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_4_open', 'wod_open_11_4', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_4_benchmark', 'wod_open_11_4', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_5_open', 'wod_open_11_5', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_5_benchmark', 'wod_open_11_5', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_6_open', 'wod_open_11_6', 'tag_open', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_open_11_6_benchmark', 'wod_open_11_6', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create workout movements relationships
INSERT OR IGNORE INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES
('wm_open_25_1_dbcleanjerk', 'wod_open_25_1', 'mov_dbcleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_1_clean', 'wod_open_25_1', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_1_burpee', 'wod_open_25_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_1_hangclean', 'wod_open_25_1', 'mov_hangclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_1_lunge', 'wod_open_25_1', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_thruster', 'wod_open_25_2', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_doubleunder', 'wod_open_25_2', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_ctbpullup', 'wod_open_25_2', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_pullup', 'wod_open_25_2', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_muscleup', 'wod_open_25_2', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_2_barmuscleup', 'wod_open_25_2', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_3_snatch', 'wod_open_25_3', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_3_deadlift', 'wod_open_25_3', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_3_wallwalk', 'wod_open_25_3', 'mov_wallwalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_3_clean', 'wod_open_25_3', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_25_3_row', 'wod_open_25_3', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_1_snatch', 'wod_open_24_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_1_dbsnatch', 'wod_open_24_1', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_1_burpee', 'wod_open_24_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_2_doubleunder', 'wod_open_24_2', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_2_row', 'wod_open_24_2', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_2_deadlift', 'wod_open_24_2', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_3_thruster', 'wod_open_24_3', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_3_ctbpullup', 'wod_open_24_3', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_3_pullup', 'wod_open_24_3', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_3_muscleup', 'wod_open_24_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_24_3_barmuscleup', 'wod_open_24_3', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_1_clean', 'wod_open_23_1', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_1_row', 'wod_open_23_1', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_1_toestobar', 'wod_open_23_1', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_1_wallball', 'wod_open_23_1', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_1_muscleup', 'wod_open_23_1', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_2a_pullup', 'wod_open_23_2a', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_2a_shuttlerun', 'wod_open_23_2a', 'mov_shuttlerun', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_2a_burpee', 'wod_open_23_2a', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_2a_burpeepullup', 'wod_open_23_2a', 'mov_burpeepullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_2b_thruster', 'wod_open_23_2b', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_snatch', 'wod_open_23_3', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_wallwalk', 'wod_open_23_3', 'mov_wallwalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_pushup', 'wod_open_23_3', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_doubleunder', 'wod_open_23_3', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_stricthspu', 'wod_open_23_3', 'mov_stricthspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_23_3_hspu', 'wod_open_23_3', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_1_snatch', 'wod_open_22_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_1_dbsnatch', 'wod_open_22_1', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_1_wallwalk', 'wod_open_22_1', 'mov_wallwalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_1_boxjump', 'wod_open_22_1', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_1_boxjumpover', 'wod_open_22_1', 'mov_boxjumpover', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_2_deadlift', 'wod_open_22_2', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_2_barfacingburpee', 'wod_open_22_2', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_2_burpee', 'wod_open_22_2', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_thruster', 'wod_open_22_3', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_doubleunder', 'wod_open_22_3', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_ctbpullup', 'wod_open_22_3', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_pullup', 'wod_open_22_3', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_muscleup', 'wod_open_22_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_22_3_barmuscleup', 'wod_open_22_3', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_1_doubleunder', 'wod_open_21_1', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_1_wallwalk', 'wod_open_21_1', 'mov_wallwalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_snatch', 'wod_open_21_2', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_dbsnatch', 'wod_open_21_2', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_boxjump', 'wod_open_21_2', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_burpee', 'wod_open_21_2', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_burpeebox', 'wod_open_21_2', 'mov_burpeebox', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_2_boxjumpover', 'wod_open_21_2', 'mov_boxjumpover', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_thruster', 'wod_open_21_3', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_frontsquat', 'wod_open_21_3', 'mov_frontsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_toestobar', 'wod_open_21_3', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_ctbpullup', 'wod_open_21_3', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_pullup', 'wod_open_21_3', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_muscleup', 'wod_open_21_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_3_barmuscleup', 'wod_open_21_3', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_4_clean', 'wod_open_21_4', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_4_hangclean', 'wod_open_21_4', 'mov_hangclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_4_deadlift', 'wod_open_21_4', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_21_4_jerk', 'wod_open_21_4', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_1_barfacingburpee', 'wod_open_20_1', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_1_burpee', 'wod_open_20_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_1_groundtooverhead', 'wod_open_20_1', 'mov_groundtooverhead', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_2_doubleunder', 'wod_open_20_2', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_2_thruster', 'wod_open_20_2', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_2_dbthruster', 'wod_open_20_2', 'mov_dbthruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_2_toestobar', 'wod_open_20_2', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_3_hswalk', 'wod_open_20_3', 'mov_hswalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_3_pushup', 'wod_open_20_3', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_3_deadlift', 'wod_open_20_3', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_3_hspu', 'wod_open_20_3', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_4_pistol', 'wod_open_20_4', 'mov_pistol', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_4_clean', 'wod_open_20_4', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_4_boxjump', 'wod_open_20_4', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_4_jerk', 'wod_open_20_4', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_4_cleanjerk', 'wod_open_20_4', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_5_wallball', 'wod_open_20_5', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_5_muscleup', 'wod_open_20_5', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_20_5_row', 'wod_open_20_5', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_1_wallball', 'wod_open_19_1', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_1_row', 'wod_open_19_1', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_2_doubleunder', 'wod_open_19_2', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_2_clean', 'wod_open_19_2', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_2_sqclean', 'wod_open_19_2', 'mov_sqclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_2_toestobar', 'wod_open_19_2', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_dbboxstepup', 'wod_open_19_3', 'mov_dbboxstepup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_pushup', 'wod_open_19_3', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_dbohlunge', 'wod_open_19_3', 'mov_dbohlunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_boxstepup', 'wod_open_19_3', 'mov_boxstepup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_stricthspu', 'wod_open_19_3', 'mov_stricthspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_hswalk', 'wod_open_19_3', 'mov_hswalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_hspu', 'wod_open_19_3', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_lunge', 'wod_open_19_3', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_3_ohlunge', 'wod_open_19_3', 'mov_ohlunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_4_snatch', 'wod_open_19_4', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_4_barfacingburpee', 'wod_open_19_4', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_4_burpee', 'wod_open_19_4', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_4_muscleup', 'wod_open_19_4', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_4_barmuscleup', 'wod_open_19_4', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_5_thruster', 'wod_open_19_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_5_ctbpullup', 'wod_open_19_5', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_19_5_pullup', 'wod_open_19_5', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_dbcleanjerk', 'wod_open_18_1', 'mov_dbcleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_clean', 'wod_open_18_1', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_row', 'wod_open_18_1', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_toestobar', 'wod_open_18_1', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_hangclean', 'wod_open_18_1', 'mov_hangclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_jerk', 'wod_open_18_1', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_1_cleanjerk', 'wod_open_18_1', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_2_barfacingburpee', 'wod_open_18_2', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_2_dbsquat', 'wod_open_18_2', 'mov_dbsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_2_burpee', 'wod_open_18_2', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_snatch', 'wod_open_18_3', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_dbsnatch', 'wod_open_18_3', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_doubleunder', 'wod_open_18_3', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_ohsquat', 'wod_open_18_3', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_muscleup', 'wod_open_18_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_barmuscleup', 'wod_open_18_3', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_3_ringmuscleup', 'wod_open_18_3', 'mov_ringmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_4_hswalk', 'wod_open_18_4', 'mov_hswalk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_4_pushup', 'wod_open_18_4', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_4_deadlift', 'wod_open_18_4', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_4_hspu', 'wod_open_18_4', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_5_thruster', 'wod_open_18_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_5_ctbpullup', 'wod_open_18_5', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_18_5_pullup', 'wod_open_18_5', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_snatch', 'wod_open_17_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_dbsnatch', 'wod_open_17_1', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_boxjump', 'wod_open_17_1', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_burpee', 'wod_open_17_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_burpeebox', 'wod_open_17_1', 'mov_burpeebox', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_1_boxjumpover', 'wod_open_17_1', 'mov_boxjumpover', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_clean', 'wod_open_17_2', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_dbpowerclean', 'wod_open_17_2', 'mov_dbpowerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_toestobar', 'wod_open_17_2', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_powerclean', 'wod_open_17_2', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_lunge', 'wod_open_17_2', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_muscleup', 'wod_open_17_2', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_2_barmuscleup', 'wod_open_17_2', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_3_snatch', 'wod_open_17_3', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_3_pullup', 'wod_open_17_3', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_4_wallball', 'wod_open_17_4', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_4_row', 'wod_open_17_4', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_4_deadlift', 'wod_open_17_4', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_4_hspu', 'wod_open_17_4', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_5_doubleunder', 'wod_open_17_5', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_17_5_thruster', 'wod_open_17_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_1_barfacingburpee', 'wod_open_16_1', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_1_burpee', 'wod_open_16_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_1_pullup', 'wod_open_16_1', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_1_lunge', 'wod_open_16_1', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_1_ohlunge', 'wod_open_16_1', 'mov_ohlunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_2_doubleunder', 'wod_open_16_2', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_2_clean', 'wod_open_16_2', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_2_sqclean', 'wod_open_16_2', 'mov_sqclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_2_toestobar', 'wod_open_16_2', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_3_snatch', 'wod_open_16_3', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_3_powersnatch', 'wod_open_16_3', 'mov_powersnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_3_muscleup', 'wod_open_16_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_3_barmuscleup', 'wod_open_16_3', 'mov_barmuscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_4_wallball', 'wod_open_16_4', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_4_row', 'wod_open_16_4', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_4_deadlift', 'wod_open_16_4', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_4_hspu', 'wod_open_16_4', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_5_barfacingburpee', 'wod_open_16_5', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_5_burpee', 'wod_open_16_5', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_16_5_thruster', 'wod_open_16_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_snatch', 'wod_open_15_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_deadlift', 'wod_open_15_1', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_clean', 'wod_open_15_1', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_toestobar', 'wod_open_15_1', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_jerk', 'wod_open_15_1', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_1_cleanjerk', 'wod_open_15_1', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_2_ohsquat', 'wod_open_15_2', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_2_pullup', 'wod_open_15_2', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_3_doubleunder', 'wod_open_15_3', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_3_wallball', 'wod_open_15_3', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_3_muscleup', 'wod_open_15_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_4_clean', 'wod_open_15_4', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_4_hspu', 'wod_open_15_4', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_5_thruster', 'wod_open_15_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_15_5_row', 'wod_open_15_5', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_1_doubleunder', 'wod_open_14_1', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_1_snatch', 'wod_open_14_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_1_powersnatch', 'wod_open_14_1', 'mov_powersnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_2_ohsquat', 'wod_open_14_2', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_2_pullup', 'wod_open_14_2', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_3_boxjump', 'wod_open_14_3', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_3_deadlift', 'wod_open_14_3', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_4_clean', 'wod_open_14_4', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_4_row', 'wod_open_14_4', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_4_toestobar', 'wod_open_14_4', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_4_wallball', 'wod_open_14_4', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_4_muscleup', 'wod_open_14_4', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_5_barfacingburpee', 'wod_open_14_5', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_5_burpee', 'wod_open_14_5', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_14_5_thruster', 'wod_open_14_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_1_snatch', 'wod_open_13_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_1_targetburpee', 'wod_open_13_1', 'mov_targetburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_1_burpee', 'wod_open_13_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_2_boxjump', 'wod_open_13_2', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_2_deadlift', 'wod_open_13_2', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_2_shouldertooverhead', 'wod_open_13_2', 'mov_shouldertooverhead', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_3_doubleunder', 'wod_open_13_3', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_3_wallball', 'wod_open_13_3', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_3_muscleup', 'wod_open_13_3', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_4_clean', 'wod_open_13_4', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_4_cleanjerk', 'wod_open_13_4', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_4_toestobar', 'wod_open_13_4', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_4_jerk', 'wod_open_13_4', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_5_thruster', 'wod_open_13_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_13_5_pullup', 'wod_open_13_5', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_1_targetburpee', 'wod_open_12_1', 'mov_targetburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_1_burpee', 'wod_open_12_1', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_2_snatch', 'wod_open_12_2', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_3_boxjump', 'wod_open_12_3', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_3_toestobar', 'wod_open_12_3', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_3_pushpress', 'wod_open_12_3', 'mov_pushpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_4_doubleunder', 'wod_open_12_4', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_4_wallball', 'wod_open_12_4', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_4_muscleup', 'wod_open_12_4', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_5_thruster', 'wod_open_12_5', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_12_5_pullup', 'wod_open_12_5', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_1_doubleunder', 'wod_open_11_1', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_1_snatch', 'wod_open_11_1', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_1_powersnatch', 'wod_open_11_1', 'mov_powersnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_2_hrpushup', 'wod_open_11_2', 'mov_hrpushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_2_boxjump', 'wod_open_11_2', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_2_deadlift', 'wod_open_11_2', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_2_pushup', 'wod_open_11_2', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_3_clean', 'wod_open_11_3', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_3_sqclean', 'wod_open_11_3', 'mov_sqclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_3_jerk', 'wod_open_11_3', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_4_barfacingburpee', 'wod_open_11_4', 'mov_barfacingburpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_4_ohsquat', 'wod_open_11_4', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_4_muscleup', 'wod_open_11_4', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_4_burpee', 'wod_open_11_4', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_5_clean', 'wod_open_11_5', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_5_wallball', 'wod_open_11_5', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_5_toestobar', 'wod_open_11_5', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_5_powerclean', 'wod_open_11_5', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_6_thruster', 'wod_open_11_6', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_open_11_6_pullup', 'wod_open_11_6', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Add workouts to the Open programming track
INSERT OR IGNORE INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES
('trwk_open_open_25_1', 'ptrk_open', 'wod_open_25_1', 68, null, 'As many rounds and reps as possible in 15 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_25_2', 'ptrk_open', 'wod_open_25_2', 67, null, '(22.3 repeat) For time: 21 pull-ups 42 double-unde…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_25_3', 'ptrk_open', 'wod_open_25_3', 66, null, 'For time: 5 wall walks 50-calorie row 5 wall walks…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_24_1', 'ptrk_open', 'wod_open_24_1', 65, null, 'For time: 21 dumbbell snatches, arm 1 21 lateral b…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_24_2', 'ptrk_open', 'wod_open_24_2', 64, null, 'As many rounds and reps as possible in 20 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_24_3', 'ptrk_open', 'wod_open_24_3', 63, null, 'All for time: 5 rounds of: 10 thrusters, weight 1 …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_23_1', 'ptrk_open', 'wod_open_23_1', 62, null, 'Complete as many reps as possible in 14 minutes of…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_23_2a', 'ptrk_open', 'wod_open_23_2a', 61, null, 'Complete as many reps as possible in 15 minutes of…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_23_2b', 'ptrk_open', 'wod_open_23_2b', 60, null, 'Immediately following 23.2A, athletes will have 5 …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_23_3', 'ptrk_open', 'wod_open_23_3', 59, null, 'Starting with a 6-minute time cap, complete as man…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_22_1', 'ptrk_open', 'wod_open_22_1', 58, null, 'Complete as many rounds as possible in 15 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_22_2', 'ptrk_open', 'wod_open_22_2', 57, null, '1-2-3-4-5-6-7-8-9-10-9-8-7-6-5-4-3-2-1 reps for ti…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_22_3', 'ptrk_open', 'wod_open_22_3', 56, null, 'For time: 21 pull-ups 42 double-unders 21 thruster…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_21_1', 'ptrk_open', 'wod_open_21_1', 55, null, 'For time: 1 wall walk 10 double-unders 3 wall walk…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_21_2', 'ptrk_open', 'wod_open_21_2', 54, null, 'For time: 10 dumbbell snatches 15 burpee box jump-…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_21_3', 'ptrk_open', 'wod_open_21_3', 53, null, 'For total time: 15 front squats 30 toes-to-bars 15…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_21_4', 'ptrk_open', 'wod_open_21_4', 52, null, 'Complete the following complex for max load: 1 dea…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_20_1', 'ptrk_open', 'wod_open_20_1', 51, null, '10 rounds for time of: 8 ground-to-overheads, 65 l…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_20_2', 'ptrk_open', 'wod_open_20_2', 50, null, 'Complete as many rounds as possible in 20 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_20_3', 'ptrk_open', 'wod_open_20_3', 49, null, 'For time: 21 deadlifts, 155 lb. 21 handstand push-…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_20_4', 'ptrk_open', 'wod_open_20_4', 48, null, 'For time: 30 box jumps, 20 in. 15 clean and jerks,…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_20_5', 'ptrk_open', 'wod_open_20_5', 47, null, 'For time, partitioned any way: 40 muscle-ups 80-ca…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_19_1', 'ptrk_open', 'wod_open_19_1', 46, null, 'Complete as many rounds as possible in 15 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_19_2', 'ptrk_open', 'wod_open_19_2', 45, null, 'Beginning on an 8-minute clock, complete as many r…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_19_3', 'ptrk_open', 'wod_open_19_3', 44, null, 'For time: 200-ft. dumbbell overhead lunge 50 dumbb…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_19_4', 'ptrk_open', 'wod_open_19_4', 43, null, 'For total time: 3 rounds of: 10 snatches 12 bar-fa…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_19_5', 'ptrk_open', 'wod_open_19_5', 42, null, '33-27-21-15-9 reps for time of: 65-lb. thrusters C…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_18_1', 'ptrk_open', 'wod_open_18_1', 41, null, 'Complete as many rounds as possible in 20 minutes …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_18_2', 'ptrk_open', 'wod_open_18_2', 40, null, '1-2-3-4-5-6-7-8-9-10 reps for time of: Dumbbell sq…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_18_3', 'ptrk_open', 'wod_open_18_3', 39, null, '2 rounds for time of: 100 double-unders 20 overhea…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_18_4', 'ptrk_open', 'wod_open_18_4', 38, null, '**For time:** 21 deadlifts, 225 lb. 21 handstand p…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_18_5', 'ptrk_open', 'wod_open_18_5', 37, null, '**7 Min AMRAP** 3-6-9-… thrusters 100 lbs 3-6-9-… …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_17_1', 'ptrk_open', 'wod_open_17_1', 36, null, '**For Time** 10 Dumbbell Snatch 50/35 lbs 15 Burpe…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_17_2', 'ptrk_open', 'wod_open_17_2', 35, null, '**12 Min AMRAP** **2 Rounds of:** 50 feet Dumbbell…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_17_3', 'ptrk_open', 'wod_open_17_3', 34, null, '**Prior to 8:00, complete:** **3 rounds of:** 6 Ch…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_17_4', 'ptrk_open', 'wod_open_17_4', 33, null, '**13 Min AMRAP** 55 Deadlifts 225/155 lbs 55 Wall …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_17_5', 'ptrk_open', 'wod_open_17_5', 32, null, '**10 Rounds of** 9 Thrusters 95/65 lbs 35 DUs', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_16_1', 'ptrk_open', 'wod_open_16_1', 31, null, '**20 Min AMRAP** 25-ft. Overhead Walking Lunges 95…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_16_2', 'ptrk_open', 'wod_open_16_2', 30, null, '**4 Min Time Cap for** 25 Toes-to-Bars 50 Double-U…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_16_3', 'ptrk_open', 'wod_open_16_3', 29, null, '**7 Min AMRAP** 10 Power Snatches 75/55 lbs 3 Bar …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_16_4', 'ptrk_open', 'wod_open_16_4', 28, null, '**13 Min AMRAP** 55 Deadlifts 225/155 lbs 55 Wall …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_16_5', 'ptrk_open', 'wod_open_16_5', 27, null, '**For Time** **21-18-15-12-9-6-3** Thrusters 95/65…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_15_1', 'ptrk_open', 'wod_open_15_1', 26, null, '**Part A: 9 Min AMRAP** 15 Toes-to-Bars 10 Deadlif…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_15_2', 'ptrk_open', 'wod_open_15_2', 25, null, '**From 0:00 to 3:00** **2 Rounds of** 10 Overhead …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_15_3', 'ptrk_open', 'wod_open_15_3', 24, null, '**14 Min AMRAP** 7 Muscle Ups 50 Wall Balls 20/14 …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_15_4', 'ptrk_open', 'wod_open_15_4', 23, null, '**8 Min AMRAP** 3-6-9-12-15-18-21-… HSPU 3-3-3-6-6…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_15_5', 'ptrk_open', 'wod_open_15_5', 22, null, '**For Time** **27-21-15-9** Row (calories) Thruste…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_14_1', 'ptrk_open', 'wod_open_14_1', 21, null, '**10 Min AMRAP** 30 DUs 15 Power Snatches 75/55 lb…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_14_2', 'ptrk_open', 'wod_open_14_2', 20, null, '**From 0:00 to 3:00** **2 Rounds of** 10 Overhead …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_14_3', 'ptrk_open', 'wod_open_14_3', 19, null, '**8 Min Time Cap** 10 Deadlifts 135/95 lbs 15 Box …', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_14_4', 'ptrk_open', 'wod_open_14_4', 18, null, '**14 Min AMRAP** 60 cal Row 50 Toes-to-Bars 40 Wal…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_14_5', 'ptrk_open', 'wod_open_14_5', 17, null, '**For Time** **21-18-15-12-9-6-3** Thrusters 95/65…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_13_1', 'ptrk_open', 'wod_open_13_1', 16, null, '**17 Min AMRAP** 40 Target Burpees 30 Snatches 75/…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_13_2', 'ptrk_open', 'wod_open_13_2', 15, null, '**10 Min AMRAP** 5 Shoulder-to-Overhead 115/75 lbs…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_13_3', 'ptrk_open', 'wod_open_13_3', 14, null, '**12 Min AMRAP** 150 Wall Balls 20/14 lbs 90 DUs 3…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_13_4', 'ptrk_open', 'wod_open_13_4', 13, null, '**7 Min AMRAP** **3-6-9-12-…** Clean and Jerks 135…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_13_5', 'ptrk_open', 'wod_open_13_5', 12, null, '**4 Min AMRAP** 15 Thrusters 100/65 lbs 15 Chest-t…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_12_1', 'ptrk_open', 'wod_open_12_1', 11, null, '**7 Min AMRAP** Target Burpees', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_12_2', 'ptrk_open', 'wod_open_12_2', 10, null, '**10 Min AMRAP** 30 Snatches 75/45 lbs 30 Snatches…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_12_3', 'ptrk_open', 'wod_open_12_3', 9, null, '**18 Min AMRAP** 15 Box Jumps 24/20? 12 Push Press…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_12_4', 'ptrk_open', 'wod_open_12_4', 8, null, '**12 Min AMRAP** 150 Wall Balls 20/14 lbs 90 DUs 3…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_12_5', 'ptrk_open', 'wod_open_12_5', 7, null, '**7 Min AMRAP** **3-6-9-12-15-…** Thrusters 100/65…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_1', 'ptrk_open', 'wod_open_11_1', 6, null, '**10 Min AMRAP** 30 DUs 15 Power Snatches 75/55 lb…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_2', 'ptrk_open', 'wod_open_11_2', 5, null, '**15 Min AMRAP** 9 Deadlifts 155/100 lbs 12 HR Pus…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_3', 'ptrk_open', 'wod_open_11_3', 4, null, '**5 Min AMRAP** Squat Clean 165/110 lbs Jerk 165/1…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_4', 'ptrk_open', 'wod_open_11_4', 3, null, '**10 Min AMRAP** 60 Bar Facing Burpees 30 Overhead…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_5', 'ptrk_open', 'wod_open_11_5', 2, null, '**20 Min AMRAP** 5 Power Cleans 145/100 lbs 10 Toe…', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_open_open_11_6', 'ptrk_open', 'wod_open_11_6', 1, null, '**7 Min AMRAP** **3-6-9-12-15-…** Thrusters 100/65…', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;
