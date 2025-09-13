-- CrossFit Heroes Workouts Seed Script
-- Creates CrossFit user, team, and all Heroes benchmark workouts in a programming track
-- Password for crossfit@gmail.com is "crossfit"
-- Uses existing CrossFit user, team, and team membership from Girls seed script

-- Create Heroes programming track
INSERT INTO programming_track (id, name, description, type, ownerTeamId, isPublic, createdAt, updatedAt, updateCounter) VALUES 
('ptrk_heroes', 'Heroes', 'CrossFit Heroes benchmark workouts - honoring fallen military, law enforcement, and first responders', 'official_third_party', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Subscribe CrossFit team to Heroes programming track
INSERT INTO team_programming_track (teamId, trackId, isActive, subscribedAt, startDayOffset, createdAt, updatedAt, updateCounter) VALUES 
('team_cokkpu1klwo0ulfhl1iwzpvn', 'ptrk_heroes', 1, CURRENT_TIMESTAMP, 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create all Heroes workouts
INSERT INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES 

-- JT
('wod_jt', 'JT', '21-15-9 reps for time of:
• Handstand push-ups
• Ring dips
• Push-ups

In honor of Petty Officer 1st Class Jeff Taylor, 30, of Midway, West Virginia, who was killed on June 28, 2005, while conducting combat operations in the vicinity of Asadabad, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Michael  
('wod_michael', 'Michael', '3 rounds for time of:
• Run 800 meters
• 50 back extensions
• 50 sit-ups

In honor of Navy Lieutenant Michael McGreevy, 30, of Portville, NY, who was killed in Afghanistan June 28.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Murph
('wod_murph', 'Murph', 'For time:
• 1-mile run
• 100 pull-ups
• 200 push-ups
• 300 squats
• 1-mile run

Partition the pull-ups, push-ups, and squats as needed. Start and finish with a mile run. If you''ve got a 20-lb vest or body armor, wear it.

In memory of Navy Lieutenant Michael Murphy, 29, of Patchogue, N.Y., who was killed in Afghanistan June 28, 2005.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Daniel
('wod_daniel', 'Daniel', 'For time:
• 50 pull-ups
• 400-meter run
• 21 thrusters (♀ 65 lb / ♂ 95 lb)
• 800-meter run
• 21 thrusters (♀ 65 lb / ♂ 95 lb)
• 400-meter run
• 50 pull-ups

In honor of Army Sgt 1st Class Daniel Crabtree who was killed in Al Kut, Iraq on Thursday, June 8.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Josh
('wod_josh', 'Josh', 'For time:
• 21 overhead squats (♀ 65 lb / ♂ 95 lb)
• 42 pull-ups
• 15 overhead squats (♀ 65 lb / ♂ 95 lb)
• 30 pull-ups
• 9 overhead squats (♀ 65 lb / ♂ 95 lb)
• 18 pull-ups

In honor of U.S. Army Staff Sgt. Joshua Hager, 29, of Broomfield, Colorado, who was killed Thursday, Feb. 22, 2007, when an improvised explosive device detonated near his Humvee during combat operations in Ramadi, Iraq.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jason
('wod_jason', 'Jason', 'For time:
• 100 squats
• 5 muscle-ups
• 75 squats
• 10 muscle-ups
• 50 squats
• 15 muscle-ups
• 25 squats
• 20 muscle-ups

In honor of S01 (SEAL) Jason Dale Lewis who was killed by an IED while conducting combat operations in Southern Baghdad July 6, 2007.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Badger
('wod_badger', 'Badger', '3 rounds for time of:
• 30 squat cleans (♀ 65 lb / ♂ 95 lb)
• 30 pull-ups
• Run 800 meters

In honor of U.S. Navy Chief Petty Officer Mark Carter, 27, of Fallbrook, California, who was killed during combat operations in Iraq on Dec. 11, 2007.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Joshie
('wod_joshie', 'Joshie', '3 rounds for time of:
• 21 dumbbell snatches, right arm (♀ 25 lb / ♂ 40 lb)
• 21 L pull-ups
• 21 dumbbell snatches, left arm (♀ 25 lb / ♂ 40 lb)
• 21 L pull-ups

In honor of U.S. Army Staff Sgt. Joshua Whitaker, 23, of Long Beach, California, who died of wounds sustained in small-arms fire in Afghanistan on May 15, 2007.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nate
('wod_nate', 'Nate', 'Complete as many rounds as possible in 20 minutes of:
• 2 muscle-ups
• 4 handstand push-ups
• 8 kettlebell swings (♀ 53 lb / ♂ 70 lb)

In honor of U.S. Navy Chief Special Warfare Operator (SEAL) Nate Hardy, who was killed Sunday, Feb. 4, 2008, during combat operations in Iraq.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Randy
('wod_randy', 'Randy', 'For time:
• 75 power snatches (♀ 55 lb / ♂ 75 lb)

In honor of Randy Simmons, 51, a 27-year LAPD veteran and SWAT team member who was killed Feb. 7, 2008, in the line of duty.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tommy V
('wod_tommy_v', 'Tommy V', 'For time:
• 21 thrusters (♀ 75 lb / ♂ 115 lb)
• 12 rope climbs (15-foot rope)
• 15 thrusters (♀ 75 lb / ♂ 115 lb)
• 9 rope climbs (15-foot rope)
• 9 thrusters (♀ 75 lb / ♂ 115 lb)
• 6 rope climbs (15-foot rope)

In honor of Senior Chief Petty Officer Thomas J. Valentine, 37, of Ham Lake, Minnesota, who died in a training accident in Arizona, on Feb. 13, 2008.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Griff
('wod_griff', 'Griff', 'For time:
• Run 800 meters
• Run 400 meters backwards
• Run 800 meters
• Run 400 meters backwards

In honor of U.S. Air Force Staff Sgt. Travis L. Griffin, 28, who was killed on April 3, 2008, in the Rasheed District of Baghdad, by an improvised explosive device strike to his vehicle.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ryan
('wod_ryan', 'Ryan', '5 rounds for time of:
• 7 muscle-ups
• 21 burpees

In honor of Maplewood, Missouri, firefighter, Ryan Hummert, 22, who was killed by sniper fire, July 21, 2008, when he stepped off his fire truck responding to a call.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Erin
('wod_erin', 'Erin', '5 rounds for time of:
• 15 dumbbell split cleans (♀ 30 lb / ♂ 40 lb)
• 21 pull-ups

In honor of Canadian Army Master Cpl. Erin Doyle, 32, who was killed in a firefight on Aug. 11, 2008, in the Panjwaii District, Kandahar Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Mr. Joshua
('wod_mr_joshua', 'Mr. Joshua', '5 rounds for time of:
• Run 400 meters
• 30 GHD sit-ups
• 15 deadlifts (♀ 175 lb / ♂ 250 lb)

In honor of U.S. Navy Special Warfare Operator 1st Class (SEAL) Joshua Thomas Harris, 36, who drowned during combat operations on Aug. 30, 2008, in Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- DT
('wod_dt', 'DT', '5 rounds for time of:
• 12 deadlifts (♀ 105 lb / ♂ 155 lb)
• 9 hang power cleans (♀ 105 lb / ♂ 155 lb)
• 6 push jerks (♀ 105 lb / ♂ 155 lb)

In honor of U.S. Air Force Staff Sgt. Timothy P. Davis, 28, who was killed on Feb. 20, 2009, while he was supporting operations in OEF and his vehicle was struck by an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Danny
('wod_danny', 'Danny', 'Complete as many rounds in 20 minutes as you can of:
• 30 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 20 push presses (♀ 75 lb / ♂ 115 lb)
• 30 pull-ups

In honor of Oakland SWAT Sgt. Daniel Sakai, 35, who was killed in the line of duty on March 21, 2009, along with fellow officers Sgt. Ervin Romans, Sgt. Mark Dunakin and Officer John Hege.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hansen
('wod_hansen', 'Hansen', '5 rounds for time of:
• 30 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• 30 burpees
• 30 GHD sit-ups

In honor of U.S. Marine Staff Sgt. Daniel Hansen who died Feb. 14, 2009, in Farah Province, Afghanistan, when an improvised explosive device he was working on detonated.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tyler
('wod_tyler', 'Tyler', '5 rounds for time of:
• 7 muscle-ups
• 21 sumo deadlift high pulls (♀ 65 lb / ♂ 95 lb)

In honor of U.S. Army 1st Lt. Tyler E. Parten, 24, of Arkansas, who died Sept. 10, 2009, in Konar Province, Afghanistan, of wounds sustained when insurgents attacked his unit.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Lumberjack 20
('wod_lumberjack_20', 'Lumberjack 20', 'For time:
• 20 deadlifts (♀ 185 lb / ♂ 275 lb)
• Run 400 meters
• 20 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• Run 400 meters
• 20 overhead squats (♀ 75 lb / ♂ 115 lb)
• Run 400 meters
• 20 burpees
• Run 400 meters
• 20 chest-to-bar pull-ups
• Run 400 meters
• 20 box jumps (♀ 20-inch box / ♂ 24-inch box)
• Run 400 meters
• 20 dumbbell squat cleans (♀ 30 lb / ♂ 45 lb)
• Run 400 meters

In honor of the soldiers and civilians killed and wounded at Fort Hood, Texas on Nov. 5, 2009, including CrossFit athletes from the 20th Engineer Battalion.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Stephen
('wod_stephen', 'Stephen', '30-25-20-15-10-5 reps for time of:
• GHD sit-ups
• Back extensions
• Knees-to-elbows
• Stiff-legged deadlift (♀ 65 lb / ♂ 95 lb)

In honor of Third Battalion, Princess Patricia''s Canadian Light Infantry member Cpl. Stephen Bouzane, 26, who was killed by an improvised explosive device on June 20, 2007, in the Panjwaii District in Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Garrett
('wod_garrett', 'Garrett', '3 rounds for time of:
• 75 squats
• 25 ring handstand push-ups
• 25 L pull-ups

In honor of U.S. Marine Capt. Garrett T. "Tubes" Lawton, 31, of Charleston, West Virginia, who was killed by an improvised explosive device in Herat Province, Afghanistan, on Aug. 4, 2008.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- War Frank
('wod_war_frank', 'War Frank', '3 rounds for time of:
• 25 muscle-ups
• 100 squats
• 35 GHD sit-ups

In honor of U.S. Marine Capt. Warren A. Frank, 26, of Cincinnati, Ohio, who died Nov. 25, 2008, while supporting combat operations in Ninewa Province, Iraq.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- McGhee
('wod_mcghee', 'McGhee', 'As many rounds as possible in 30 minutes of:
• 5 deadlifts (♀ 185 lb / ♂ 275 lb)
• 13 push-ups
• 9 box jumps (♀ 20-inch box / ♂ 24-inch box)

In honor of U.S. Army Cpl. Ryan C. McGhee, 21, who was killed in action on May 13, 2009, by small-arms fire during combat in central Iraq.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Paul
('wod_paul', 'Paul', '5 rounds for time of:
• 50 double-unders
• 35 knees-to-elbows
• 20-yard overhead walk (♀ 125 lb / ♂ 185 lb)

In honor of Pittsburgh Police Officer Paul John Rizzo Domenic Sciullo II, 36, who was shot and killed in the line of duty while responding to a domestic disturbance call on April 4, 2009.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jerry
('wod_jerry', 'Jerry', 'For time:
• Run 1 mile
• Row 2K
• Run 1 mile

In honor of U.S. Army Sgt. Maj. Jerry Dwayne Patton, 40, who died on Oct. 15, 2008, during High Altitude High Opening (HAHO) training while preparing for deployment to Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nutts
('wod_nutts', 'Nutts', 'For time:
• 10 handstand push-ups
• 15 deadlifts (♀ 175 lb / ♂ 250 lb)
• 25 box jumps (♀ 24-inch box / ♂ 30-inch box)
• 50 pull-ups
• 100 wall-ball shots (♀ 14-lb ball to 9 feet / ♂ 20-lb ball to 10 feet)
• 200 double-unders
• Run 400 meters with a plate (♀ 25 lb / ♂ 45 lb)

In honor of Canadian Armed Forces Lt. Andrew Richard Nuttall, 30, who was killed by an improvised explosive device in Panjwaii District, Afghanistan, on Dec. 23, 2009.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Arnie
('wod_arnie', 'Arnie', 'With a single kettlebell for time:
• 21 Turkish get-ups, right arm (♀ 53 lb / ♂ 70 lb)
• 50 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• 21 overhead squats, left arm (♀ 53 lb / ♂ 70 lb)
• 50 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• 21 overhead squats, right arm (♀ 53 lb / ♂ 70 lb)
• 50 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• 21 Turkish get-ups, left arm (♀ 53 lb / ♂ 70 lb)

In honor of Los Angeles County Firefighter Specialist Arnaldo "Arnie" Quinones, 34, who was killed in the line of duty on Aug. 30, 2009, during the Station Fire.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- The Seven
('wod_the_seven', 'The Seven', '7 rounds for time of:
• 7 handstand push-ups
• 7 thrusters (♀ 95 lb / ♂ 135 lb)
• 7 knees-to-elbows
• 7 deadlifts (♀ 165 lb / ♂ 245 lb)
• 7 burpees
• 7 kettlebell swings (♀ 53 lb / ♂ 70 lb)
• 7 pull-ups

In honor of the seven CIA officers and one Jordanian officer killed by a suicide bomber at a remote base in southeastern Afghanistan on Dec. 30, 2009.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- RJ
('wod_rj', 'RJ', '5 rounds for time of:
• Run 800 meters
• 5 rope climbs to 15 feet
• 50 push-ups

In honor of veteran LAPD officer and U.S. Marine Corps Reservist Sgt. Maj. Robert J. Cottle, 45, who was killed by an improvised explosive device while on patrol in southern Afghanistan on March 24, 2010.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Luce
('wod_luce', 'Luce', 'Wearing a weight vest, 3 rounds for time of:
• 1K run
• 10 muscle-ups
• 100 squats

Use a ♀ 14-lb vest / ♂ 20-lb vest

In honor of Captain Ronald G. Luce, 27, of the U.S. Army Company C, 2nd Battalion, 20th Special Forces Group, who died Aug. 2, 2009, in Qole Gerdsar, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Johnson
('wod_johnson', 'Johnson', 'Complete as many rounds and reps as possible in 20 minutes of:
• 9 deadlifts (♀ 165 lb / ♂ 245 lb)
• 8 muscle-ups
• 9 squat cleans (♀ 105 lb / ♂ 155 lb)

In honor of U.S. Marine 1st Lt. Michael E. Johnson, 25, who died Sept. 8, 2009, while supporting combat operations in Kunar Province, Afghanistan.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Roy
('wod_roy', 'Roy', '5 rounds for time of:
• 15 deadlifts (♀ 155 lb / ♂ 225 lb)
• 20 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 25 pull-ups

In honor of U.S. Marine Corps Sgt. Michael C. Roy, 25, of North Fort Myers, Florida, who was killed in action on July 8, 2009, in Nimroz Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Adambrown
('wod_adambrown', 'Adambrown', '2 rounds for time of:
• 24 deadlifts (♀ 195 lb / ♂ 295 lb)
• 24 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 24 wall-ball shots (♀ 14-lb ball to 9 feet / ♂ 20-lb ball to 10 feet)
• 24 bench presses (♀ 135 lb / ♂ 195 lb)
• 24 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 24 wall-ball shots (♀ 14-lb ball to 9 feet / ♂ 20-lb ball to 10 feet)
• 24 cleans (♀ 95 lb / ♂ 145 lb)

In honor of U.S. Navy Chief Special Warfare Operator (SEAL) Adam Lee Brown, 36, of Hot Springs, Arkansas, who was killed on March 17, 2010, in Komar Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Coe
('wod_coe', 'Coe', '10 rounds for time of:
• 10 thrusters (♀ 65 lb / ♂ 95 lb)
• 10 ring push-ups

In honor of U.S. Army 1st Lt. Ashley White-Stumpf, 24, who was killed in action on Oct. 22, 2011, in Kandahar Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Severin
('wod_severin', 'Severin', 'For time:
• 50 strict pull-ups
• 100 hand-release push-ups
• Run 5K

*If you''ve got a weight vest or body armor, wear it. (♀ 14-lb vest / ♂ 20-lb vest)

In honor of U.S. Army Sgt. 1st Class Severin W. Summers III, 43, of Bentonia, Mississippi, who was killed Aug. 2, 2009, in Qole Gerdsar, Afghanistan, after his vehicle was struck by an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Helton
('wod_helton', 'Helton', '3 rounds for time of:
• Run 800 meters
• 30 dumbbell squat cleans (♀ 35-lb dumbbells / ♂ 50-lb dumbbells)
• 30 burpees

In honor of U.S. Air Force Security Forces 1st Lt. Joseph D. Helton, 24, of Monroe, Georgia, who was killed Sept. 8, 2009, near Baghdad, Iraq, when an improvised explosive device detonated near his vehicle.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jack
('wod_jack', 'Jack', 'Complete as many rounds and reps as possible in 20 minutes of:
• 10 push presses (♀ 75-lb barbell / ♂ 115-lb barbell)
• 10 kettlebell swings (♀ 1-pood kettlebell / ♂ 1.5-pood kettlebell)
• 10 box jumps (♀ 20-inch box / ♂ 24-inch box)

In honor of U.S. Army Staff Sgt. Jack M. Martin III, 26, of Bethany, Oklahoma, who was killed Sept. 29, 2009, in Jolo Island, Philippines, from the detonation of an improvised explosive device.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Forrest
('wod_forrest', 'Forrest', '3 rounds for time of:
• 20 L pull-ups
• 30 toes-to-bars
• 40 burpees
• Run 800 meters

In honor of U.S. Drug Enforcement Administration Special Agent Forrest Nelson Leamon, 37, who was killed Oct. 26, 2009, when his helicopter crashed while on a counternarcotics mission in western Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bulger
('wod_bulger', 'Bulger', '10 rounds for time of:
• 150-meter run
• 7 chest-to-bar pull-ups
• 7 front squats (♀ 95 lb / ♂ 135 lb)
• 7 handstand push-ups

In honor of Canadian Forces Cpl. Nicholas Bulger, 30, of Peterborough, Ontario, who was killed July 3, 2009, in the Zhari District of Afghanistan when an improvised explosive device detonated near his vehicle.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Brenton
('wod_brenton', 'Brenton', '5 rounds for time of:
• 100-foot bear crawl
• 100-foot standing broad jump

Do 3 burpees after every 5 broad jumps. If you''ve got a 20-lb vest or body armor, wear it.

In honor of Field Training Officer Timothy Quinn Brenton, 39, of the Seattle Police Department, who was shot and killed in a drive-by shooting while on duty on Oct. 31, 2009.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Blake
('wod_blake', 'Blake', '4 rounds for time of:
• 100-foot overhead walking lunge (♀ 25-lb plate / ♂ 45-lb plate)
• 30 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 20 wall-ball shots (♀ 14-lb medicine ball to 9-foot target / ♂ 20-lb medicine ball to 10-foot target)
• 10 handstand push-ups

In honor of U.S. Navy Senior Chief Cryptologic Technician David Blake McLendon, 30, of Thomasville, Georgia, who was killed Sept. 21, 2010, in a helicopter crash during combat operations in the Zabul Province in Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Collin
('wod_collin', 'Collin', '6 rounds for time of:
• 400-meter sandbag carry (♀ 35-lb sandbag / ♂ 50-lb sandbag)
• 12 push presses (♀ 75 lb / ♂ 115 lb)
• 12 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 12 sumo deadlift high pulls (♀ 65 lb / ♂ 95 lb)

In honor of Navy Special Warfare Operator Chief Collin Trent Thomas, 33, of Morehead, Kentucky, who was fatally shot on August 18, 2010, during combat operations in Eastern Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Thompson
('wod_thompson', 'Thompson', '10 rounds for time of:
• 1 rope climb to 15 feet (begin seated on floor)
• 29 back squats (♀ 65 lb / ♂ 95 lb)
• 10-meter barbell farmers carry (♀ 95 lb / ♂ 135 lb)

In honor of U.S. Army Capt. David J. Thompson, 39, of Hooker, Oklahoma, who was killed on Jan. 29, 2010, while supporting combat operations in the Wardak Province of Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Whitten
('wod_whitten', 'Whitten', '5 rounds for time of:
• 22 kettlebell swings (♀ 53-lb kettlebell / ♂ 72-lb kettlebell)
• 22 box jumps (♀ 20-inch box / ♂ 24-inch box)
• 400-meter run
• 22 burpees
• 22 wall-ball shots (♀ 14-lb medicine ball to 9-foot target / ♂ 20-lb medicine ball to 10-foot target)

In honor of U.S. Army Capt. Dan Whitten, 28, of Grimes, Iowa, who died Feb. 2, 2010, when enemy forces in Zabul, Afghanistan, attacked his vehicle with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bull
('wod_bull', 'Bull', '2 rounds for time of:
• 200 double-unders
• 50 overhead squats (♀ 95-lb barbell / ♂ 135-lb barbell)
• 50 pull-ups
• 1-mile run

In honor of U.S. Marine Corps Capt. Brandon "Bull" Barrett, 27, of Marion, Indiana, who was killed on May 5, 2010, while supporting combat operations in Helmand Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Rankel
('wod_rankel', 'Rankel', 'Complete as many rounds as possible in 20 minutes of:
• 6 deadlifts (♀ 155-lb barbell / ♂ 225-lb barbell)
• 7 burpee pull-ups
• 10 kettlebell swings (♀ 53-lb kettlebell / ♂ 70-lb kettlebell)
• 200-meter run

In honor of U.S. Marine Corps Sgt. John Rankel, 23, of Speedway, Indiana, who was killed on June 7, 2010, while supporting combat operations in Helmand Province, Afghanistan.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Holbrook
('wod_holbrook', 'Holbrook', '10 rounds, each for time, of:
• 5 thrusters (♀ 75 lb / ♂ 115 lb)
• 10 pull-ups
• 100-meter sprint

Rest 1 minute between rounds.

In honor of U.S. Army Capt. Jason Holbrook, 28, of Burnet, Texas, who was killed on July 29, 2010, in Tsagay, Afghanistan, when insurgents attacked his vehicle with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 10, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ledesma
('wod_ledesma', 'Ledesma', 'Complete as many rounds and reps as possible in 20 minutes of:
• 5 parallette handstand push-ups
• 10 toes-to-rings
• 15 medicine-ball cleans (♀ 14-lb medicine ball / ♂ 20-lb medicine ball)

In honor of Narcotics Detective and Special Assignment Unit Operator Carlos Ledesma, 34, of the Chandler Police Department, who was shot and killed by drug dealers on July 28, 2010, during an undercover operation in Phoenix, Arizona.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wittman
('wod_wittman', 'Wittman', '7 rounds for time of:
• 15 kettlebell swings (♀ 35-lb kettlebell / ♂ 53-lb kettlebell)
• 15 power cleans (♀ 65-lb barbell / ♂ 95-lb barbell)
• 15 box jumps (♀ 20-inch box / ♂ 24-inch box)

In honor of U.S. Army Sgt. Jeremiah Wittman, 26, of Darby, Montana, who was killed on Feb. 13, 2010, when insurgents attacked his unit with a roadside bomb in Zhari Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- McCluskey
('wod_mccluskey', 'McCluskey', '3 rounds for time of:
• 9 muscle-ups
• 15 burpee pull-ups
• 21 pull-ups
• Run 800 meters

If you''ve got a 20-lb vest or body armor, wear it.

In honor of U.S. Army Sgt. Jason "Mick" McCluskey, 26, of McAlester, Oklahoma, who was killed on Nov. 4, 2010, when insurgents attacked his unit with small-arms fire in Zarghun Shahr, Mohammad Agha District, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Weaver
('wod_weaver', 'Weaver', '4 rounds for time of:
• 10 L pull-ups
• 15 push-ups
• 15 chest-to-bar pull-ups
• 15 push-ups
• 20 pull-ups
• 15 push-ups

In honor of U.S. Army 1st Lt. Todd W. Weaver, 26, of Hampton, Virginia, who died on Sept. 9, 2010, of wounds suffered when insurgents attacked his unit with a roadside bomb in Kandahar, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Abbate
('wod_abbate', 'Abbate', 'For time:
• 1-mile run
• 21 clean and jerks (♀ 105 lb / ♂ 155 lb)
• 800-meter run
• 21 clean and jerks (♀ 105 lb / ♂ 155 lb)
• 1-mile run

In honor of U.S. Marine Corps Sgt. Matthew T. Abbate, 26, of Honolulu, Hawaii, who was killed on Dec. 2, 2010, while conducting combat operations in Helmand Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hammer
('wod_hammer', 'Hammer', '5 rounds, each for time, of:
• 5 power cleans (♀ 95 lb / ♂ 135 lb)
• 10 front squats (♀ 95 lb / ♂ 135 lb)
• 5 jerks (♀ 95 lb / ♂ 135 lb)
• 20 pull-ups

Rest 90 seconds between rounds.

In honor of U.S. Army 1st Sgt. Michael "Hammer" Bordelon, 37, of Morgan City, Louisiana, who died on May 10, 2005, from injuries sustained when a car bomb exploded near him in Mosul, Iraq.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 5, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Moore
('wod_moore', 'Moore', 'Complete as many rounds in 20 minutes as you can of:
• 1 rope climb to 15 feet
• Run 400 meters
• Max-rep handstand push-ups

In honor of Officer David S. Moore, 29, of the Indianapolis Metropolitan Police Department, who died on Jan. 26, 2011, from gunshot wounds suffered when he stopped a stolen vehicle and the driver opened fire.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wilmot
('wod_wilmot', 'Wilmot', '6 rounds for time of:
• 50 squats
• 25 ring dips

In honor of Canadian Forces Pvt. Colin Wilmot, 24, of Fredericton, New Brunswick, Canada, who died on July 6, 2008, from wounds suffered when an explosive device detonated near him in the Panjwaii District of Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Moon
('wod_moon', 'Moon', '7 rounds for time of:
• 10 dumbbell hang split snatches, right arm (♀ 30-lb dumbbell / ♂ 40-lb dumbbell)
• 1 rope climb to 15 feet
• 10 dumbbell hang split snatches, left arm (♀ 30-lb dumbbell / ♂ 40-lb dumbbell)
• 1 rope climb

Alternate feet on the split snatches.

In honor of U.S. Army Spc. Christopher Moon, 20, of Tucson, Arizona, who died on July 13, 2010, from injuries sustained when insurgents attacked his vehicle with an improvised explosive device in Arghandab, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Small
('wod_small', 'Small', '3 rounds for time of:
• Row 1,000 meters
• 50 burpees
• 50 box jumps (♀ 20-inch box / ♂ 24-inch box)
• Run 800 meters

In honor of U.S. Army Staff Sgt. Marc Small, 29, of Collegeville, Pennsylvania, who died on Feb. 12, 2009, from wounds sustained when insurgents attacked his unit with a rocket-propelled grenade launcher and small-arms fire in Faramuz, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Morrison
('wod_morrison', 'Morrison', '50-40-30-20-10 reps for time of:
• Wall-ball shots (♀ 14-lb medicine ball to 9-foot target / ♂ 20-lb medicine ball to 10-foot target)
• Box jumps (♀ 20-inch box / ♂ 24-inch box)
• Kettlebell swings (♀ 35-lb kettlebell / ♂ 53-lb kettlebell)

In honor of U.S. Army Spc. Scott Morrison, 23, of Blue Ash, Ohio, who died on Sept. 26, 2010, from injuries suffered when insurgents in Kandahar, Afghanistan, attacked his vehicle with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Manion
('wod_manion', 'Manion', '7 rounds for time of:
• Run 400 meters
• 29 back squats (♀ 95 lb / ♂ 135 lb)

In honor of First Lt. Travis Manion, 26, of Doylestown, Pennsylvania, who was killed by sniper fire on April 29, 2007, while fighting against an enemy ambush in Anbar Province, Iraq.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gator
('wod_gator', 'Gator', '8 rounds for time of:
• 5 front squats (♀ 125 lb / ♂ 185 lb)
• 26 ring push-ups

In honor of U.S. Army Spc. Christopher "Gator" Gathercole, 21, of Santa Rosa, California, who was killed by enemy fire on May 26, 2008, in Ghazni, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bradley
('wod_bradley', 'Bradley', '10 rounds for time of:
• Sprint 100 meters
• 10 pull-ups
• Sprint 100 meters
• 10 burpees
• Rest 30 seconds

In honor of U.S. Air Force Senior Airman Bradley R. Smith, 24, of Troy, Illinois, who was killed on Jan. 3, 2010, by an improvised explosive device in Zhari District, Kandahar Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Meadows
('wod_meadows', 'Meadows', 'For time:
• 20 muscle-ups
• 25 lowers from an inverted hang on the rings, slowly, with straight body and arms
• 30 ring handstand push-ups
• 35 ring rows
• 40 ring push-ups

In honor of U.S. Marine Corps Capt. Joshua S. Meadows, 30, of Bastrop, Texas, who was killed by enemy fire on Sept. 5, 2009, in Farah Province, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Santiago
('wod_santiago', 'Santiago', '7 rounds for time of:
• 18 dumbbell hang squat cleans (♀ 20-lb dumbbells / ♂ 35-lb dumbbells)
• 18 pull-ups
• 10 power cleans (♀ 95-lb barbell / ♂ 135-lb barbell)
• 10 handstand push-ups

In honor of U.S. Army Sgt. Anibal Santiago, 37, of Belvidere, Illinois, who died on July 18, 2010, in Bagram, Afghanistan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Carse
('wod_carse', 'Carse', '21-18-15-12-9-6-3 reps for time of:
• Squat cleans (♀ 95 lb / ♂ 135 lb)
• Double-unders
• Deadlifts (♀ 125 lb / ♂ 185 lb)
• Box jumps (♀ 20-inch box / ♂ 24-inch box)

Begin each round with a 50-meter bear crawl.

In honor of U.S. Army Cpl. Nathan B. Carse, 32, of Harrod, Ohio, who died in Kandahar, Afghanistan, on Feb. 8, 2011, from wounds suffered when insurgents attacked his unit using an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bradshaw
('wod_bradshaw', 'Bradshaw', '10 rounds for time of:
• 3 handstand push-ups
• 6 deadlifts (♀ 155 lb / ♂ 225 lb)
• 12 pull-ups
• 24 double-unders

In honor of U.S. Army 1st Lt. Brian Bradshaw, 24, of Steilacoom, Washington, who died in Kheyl, Afghanistan, on June 25, 2009, from wounds suffered when insurgents detonated a roadside bomb near his vehicle.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- White
('wod_white', 'White', '5 rounds for time of:
• 3 rope climbs to 15 feet
• 10 toes-to-bars
• 21 overhead walking lunges (♀ 25-lb plate / ♂ 45-lb plate)
• 400-meter run

In honor of U.S. Army 1st Lt. Ashley White, 24, of Alliance, Ohio, who died on Oct. 22, 2011, in Kandahar Province, Afghanistan, from wounds suffered when insurgents attacked her unit with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Santora
('wod_santora', 'Santora', '3 rounds for reps of:
• 1 minute of squat cleans (♀ 105 lb / ♂ 155 lb)
• 1 minute of 20-foot shuttle sprints (20 feet forward + 20 feet backward = 1 rep)
• 1 minute of deadlifts (♀ 165 lb / ♂ 245 lb)
• 1 minute of burpees
• 1 minute of jerks (♀ 105 lb / ♂ 155 lb)

Rest 1 minute between rounds.

In honor of U.S. Army Sgt. Jason A. Santora, of Farmingville, New York, who died in Logar Province, Afghanistan, on April 23, 2010, from wounds sustained during a firefight with insurgents.', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 3, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wood
('wod_wood', 'Wood', '5 rounds for time of:
• 400-meter run
• 10 burpee box jumps (♀ 20-inch box / ♂ 24-inch box)
• 10 sumo deadlift high pulls (♀ 65-lb barbell / ♂ 95-lb barbell)
• 10 thrusters (♀ 65-lb barbell / ♂ 95-lb barbell)
• Rest 1 minute

In honor of Australian Army Sgt. Brett Wood MG, 32, of Ferntree Gully, Victoria, who died on May 23, 2011, in Helmand Province, Afghanistan, after insurgents attacked him with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Sixth batch Hero workouts
-- Klepto
('wod_klepto', 'Klepto', '4 rounds for time of:
27 box jumps
20 burpees
11 squat cleans

♀ 20-inch box, 95-lb cleans
♂ 24-inch box, 145-lb cleans

U.S. Air Force Maj. David "Klepto" L. Brodeur, 34, of Auburn, Massachusetts, assigned to the 11th Air Force, based at Joint Base Elmendorf-Richardson, Alaska, died on April 27, 2011, in Kabul, Afghanistan, of wounds sustained from gunfire from an Afghan military trainee.

He is survived by his wife, Susie; daughter, Elizabeth; and son, David.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Del
('wod_del', 'Del', 'For time:
25 burpees
Run 400 meters with a medicine ball
25 weighted pull-ups with a dumbbell
Run 400 meters with a medicine ball
25 handstand push-ups
Run 400 meters with a medicine ball
25 chest-to-bar pull-ups
Run 400 meters with a medicine ball
25 burpees

♀ 14-lb medicine ball, 15-lb dumbbell
♂ 20-lb medicine ball, 20-lb dumbbell

U.S. Army 1st Lt. Dimitri Del Castillo, 24, of Tampa, Florida, assigned to the 2nd Battalion, 35th Infantry Regiment, 3rd Brigade Combat Team, 25th Infantry Division, based in Schofield Barracks, Hawaii, died on June 25, 2011, in Kunar Province, Afghanistan, from wounds suffered when enemy forces attacked his unit with small-arms fire.

He is survived by his wife, Katie; his parents, Mr. and Mrs. Carlos E. Del Castillo; his brother, Carlos Andres; and sister, Anna.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Pheezy
('wod_pheezy', 'Pheezy', '3 rounds for time of:
5 front squats
18 pull-ups
5 deadlifts
18 toes-to-bars
5 push jerks
18 hand-release push-ups

♀ 115-lb front squats, 155-lb deadlifts, 115-lb push jerks
♂ 165-lb front squats, 225-lb deadlifts, 165-lb push jerks

U.S. Marine Corps Lance Cpl. Philip P. Clark, 19, of Gainesville, Florida, assigned to 1st Battalion, 6th Marine Regiment, 2nd Marine Division, II Marine Expeditionary Force, based in Camp Lejeune, North Carolina, died on May 18, 2010, while supporting combat operations in Helmand Province, Afghanistan.

He is survived by his wife, Ashton; father, Mike; stepmother, Tammy; mother, Rosmari Kruger; and brothers, Tyler, Kyle and Ryan Nordyke.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- J.J.
('wod_jj', 'J.J.', 'For time:
1 squat clean
10 parallette handstand push-ups
2 squat cleans
9 parallette handstand push-ups
3 squat cleans
8 parallette handstand push-ups
4 squat cleans
7 parallette handstand push-ups
5 squat cleans
6 parallette handstand push-ups
6 squat cleans
5 parallette handstand push-ups
7 squat cleans
4 parallette handstand push-ups
8 squat cleans
3 parallette handstand push-ups
9 squat cleans
2 parallette handstand push-ups
10 squat cleans
1 parallette handstand push-up

♀ 125 lb
♂ 185 lb

U.S. Marine Lance Cpl. Justin James "JJ" Wilson, 24, of Palm City, Florida, assigned to 3rd Battalion, 10th Marine Regiment, 2nd Marine Division, II Marine Expeditionary Force, based in Camp Lejeune, North Carolina, was killed on March 22, 2010, while supporting combat operations in Helmand Province, Afghanistan.

He is survived by his wife, Hannah McVeigh; parents, Lance and Frances; brother, Christopher; and sister, Jamie-Ella.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jag 28
('wod_jag_28', 'Jag 28', 'For time:
Run 800 meters
28 kettlebell swings
28 strict pull-ups
28 kettlebell clean and jerks
28 strict pull-ups
Run 800 meters

♀ 53 lb
♂ 70 lb

U.S. Air Force Senior Airman Mark Forester, 29, of Tuscaloosa, Alabama, assigned to the 21st Special Tactics Squadron, based in Pope Air Force Base, North Carolina, died on Sept. 29, 2010, while conducting combat operations in Uruzgan Province, Afghanistan.

He is survived by his parents, Ray and Pat; and siblings, Terri, David, Joseph and Thad.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Brian
('wod_brian', 'Brian', '3 rounds for time of:
5 rope climbs to 15 feet
25 back squats

♀ 125 lb
♂ 185 lb

U.S. Navy Special Warfare Operator Chief Petty Officer (SEAL) Brian R. Bill, 31, of Stamford, Connecticut, assigned to an East Coast-based Naval Special Warfare unit, died on Aug. 6, 2011, of wounds suffered when his unit''s helicopter crashed in Wardak Province, Afghanistan.

He is survived by his mother, Patricia Parry, and her husband, Dr. Michael Parry; his father, Scott; and siblings, Christian, Amy, Andrea, Kerry, Tessa and Morgan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nick
('wod_nick', 'Nick', '12 rounds for time of:
10 dumbbell hang squat cleans
6 handstand push-ups on dumbbells

♀ 30 lb
♂ 45 lb

U.S. Army Spc. Nicholas P. Steinbacher, 22, of La Crescenta, California, assigned to the 2nd Battalion, 5th Cavalry Regiment, 1st Brigade, 1st Cavalry Division, based in Fort Hood, Texas, died on Dec. 10, 2006, of injuries suffered when insurgents attacked his Humvee with an improvised explosive device in Baghdad, Iraq.

He is survived by his parents, Paul and Carolyn; and brothers, Dan and Kirk.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Strange
('wod_strange', 'Strange', '8 rounds for time of:
600-meter run
11 weighted pull-ups
11 walking lunges with two kettlebells
11 kettlebell thrusters

♀ 35 lb
♂ 53 lb

U.S. Navy Cryptologist Technician (Collection) Petty Officer 1st Class (Expeditionary Warfare Specialist) Michael J. Strange, 25, of Philadelphia, Pennsylvania, assigned to an East Coast-based Naval Special Warfare unit, died on Aug. 6, 2011, of wounds suffered when his unit''s helicopter crashed in Wardak Province, Afghanistan.

He is survived by his fiancee, Breanna Hostetler; parents, Elizabeth and Charles; and siblings, Katelyn, Carly and Charles.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tumilson
('wod_tumilson', 'Tumilson', '8 rounds for time of:
Run 200 meters
11 dumbbell burpee deadlifts

♀ 45-lb dumbbells
♂ 60-lb dumbbells

U.S. Navy Special Warfare Operator Petty Officer 1st Class (SEAL/Enlisted Surface Warfare Specialist) Jon "JT" Thomas Tumilson, 35, of Rockford, Iowa, assigned to an East Coast-based Naval Special Warfare unit, died on Aug. 6, 2011, in Wardak Province, Afghanistan, of wounds suffered when his helicopter crashed.

He is survived by his parents, George and Kathy, and Joy and Scott McMeekan; sisters, Kristie and Joy; and his dog Hawkeye.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ship
('wod_ship', 'Ship', '9 rounds for time of:
7 squat cleans
8 burpee box jumps

♀ 125-lb cleans, 30-inch box
♂ 185-lb cleans, 36-inch box

Canadian Forces Sgt. Prescott Shipway, 36, of Esterhazy, Saskatchewan, Canada, assigned to the 2nd Battalion, Princess Patricia''s Canadian Light Infantry, based in Shilo, Manitoba, Canada, was killed on Sept. 7, 2008, by a roadside bomb in Kandahar Province, Afghanistan.

He is survived by his wife, DeeDee; son, Hayden; and daughter, Rowan.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jared
('wod_jared', 'Jared', '4 rounds for time of:
Run 800 meters
40 pull-ups
70 push-ups

U.S. Army Master Sgt. Jared N. Van Aalst, 34, of Laconia, New Hampshire, assigned to the U.S. Army Special Operations Command, based in Fort Bragg, North Carolina, died Aug. 4, 2010, in Kunduz Province, Afghanistan, of wounds suffered while his unit was conducting combat operations.

He is survived by his wife, Katie Van Aalst; his daughters, Kaylie and Ava; and a posthumous son, Hugh Jared.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tully
('wod_tully', 'Tully', '4 rounds for time of:
Swim 200 meters
23 dumbbell squat cleans

♀ 30-lb dumbbells
♂ 40-lb dumbbells

U.S. Army Sgt. 1st Class Michael J. Tully, 33, of Falls Creek, Pennsylvania, assigned to the 2nd Battalion, 1st Special Forces Group (Airborne), based in Fort Lewis, Washington, died on Aug. 23, 2007, in Baghdad, Iraq, of wounds sustained from an improvised explosive device.

He is survived by his son, Slade.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Holleyman
('wod_holleyman', 'Holleyman', '30 rounds for time of:
5 wall-ball shots
3 handstand push-ups
1 power clean

♀ 14-lb medicine ball to 9 feet, 155-lb cleans
♂ 20-lb medicine ball to 10 feet, 225-lb cleans

U.S. Army Staff Sgt. Aaron N. Holleyman, 27, of Glasgow, Mississippi, assigned to the 1st Battalion, 5th Special Forces Group, based in Fort Campbell, Kentucky, was killed on Aug. 30, 2004, when his military vehicle hit an improvised explosive device in Khutayiah, Iraq.

He is survived by his daughters, Shelby and Erin; son, Zachary; parents, Ross and Glenda; and siblings, Kelly and Daniel.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Seventh batch Hero workouts
-- Adrian
('wod_adrian', 'Adrian', '7 rounds for time of:
3 forward rolls
5 wall climbs
7 toes-to-bars
9 box jumps

♀ 24-inch box
♂ 30-inch box

U.S. Army Sgt. 1st Class Adrian Elizalde, 30, of North Bend, Oregon, assigned to the 2nd Battalion, 1st Special Forces Group (Airborne), based in Fort Lewis, Washington, died on Aug. 23, 2007, in Baghdad, Iraq, of wounds sustained from an improvised explosive device.

He is survived by his parents, Jorge and Teresa; sister, Rachel; and daughter, Sydney Grace.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Glen
('wod_glen', 'Glen', 'For time:
30 clean and jerks
Run 1 mile
10 rope climbs to 15 feet
Run 1 mile
100 burpees

♀ 95-lb clean and jerks
♂ 135-lb clean and jerks

Former U.S. Navy SEAL Glen Doherty, 42, of Winchester, Massachusetts, assigned to a State Department security detail in Benghazi, Libya, died in an attack on a U.S. consulate on Sept. 11, 2012.

He is survived by his parents, Ben and Barbara; sister, Katie; and brother, Greg.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tom
('wod_tom', 'Tom', 'Complete as many rounds as possible in 25 minutes of:
7 muscle-ups
11 thrusters
14 toes-to-bars

♀ 105 lb
♂ 155 lb

U.S. Army 1st Lt. Thomas M. Martin, 27, of Ward, Arkansas, assigned to the 1st Squadron, 40th Cavalry Regiment, 4th Brigade Combat Team (Airborne), 25th Infantry Division, based in Fort Richardson, Alaska, died on Oct. 14, 2007, in Al Busayifi, Iraq, of wounds suffered when insurgents attacked his unit with small-arms fire.

He is survived by his parents, Edmund and Candis; sisters, Sarah Hood, Becky and Laura; fiancee, Erika Noyes; and grandmother, E. Jean.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ralph
('wod_ralph', 'Ralph', '4 rounds for time of:
8 deadlifts
16 burpees
3 rope climbs to 15 feet
Run 600 meters

♀ 175-lb deadlifts
♂ 250-lb deadlift

British Army 2nd Lt. Ralph Johnson, 24, of South Africa, assigned to the Household Cavalry Regiment, based in Windsor, England, was killed on Aug. 1, 2006, in Helmand Province, Afghanistan, when insurgents attacked his vehicle with an improvised explosive device.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Clovis
('wod_clovis', 'Clovis', 'For time:
Run 10 miles
150 burpee pull-ups

Partition the run and burpee pull-ups as needed.

U.S. Army 2nd Lt. Clovis T. Ray, 34, of San Antonio, Texas, assigned to the 2nd Battalion, 35th Infantry Regiment, 3rd Brigade Combat Team, 25th Infantry Division, based in Schofield Barracks, Hawaii, was killed on March 15, 2012, in Kunar Province, Afghanistan, when insurgents attacked his unit with an improvised explosive device.

He is survived by his wife, Shannon; son, Dean; parents, Bob Ben Sr. and Cecilia; brothers, Eddie and Bob Ben Jr.; and sister, Jennifer.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Weston
('wod_weston', 'Weston', '5 rounds for time of:
Row 1,000 meters
200-meter farmers carry
50-meter dumbbell waiters walk, right arm
50-meter dumbbell waiters walk, left arm

♀ 30-lb dumbbells
♂ 45-lb dumbbells

U.S. Drug Enforcement Administration Special Agent Michael E. Weston, 37, assigned to the Kabul Country Office in Kabul, Afghanistan, was killed on Oct. 29, 2009, when the helicopter he was in crashed in western Afghanistan.

He is survived by his wife, Cynthia Tidler; parents, Judy Zarit and Steve; and brother, Thomas.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Loredo
('wod_loredo', 'Loredo', '6 rounds for time of:
24 squats
24 push-ups
24 walking lunge steps
Run 400 meters

U.S. Army Staff Sgt. Edwardo Loredo, 34, of Houston, Texas, assigned to the 2nd Battalion, 508th Parachute Infantry Regiment, 4th Brigade Combat Team, 82nd Airborne Division, based in Fort Bragg, North Carolina, was killed on June 24, 2010, in Jelewar, Afghanistan, when insurgents attacked his unit with an improvised explosive device.

He is survived by his wife, 1st Sgt. Jennifer Loredo; daughter, Laura Isabelle; stepdaughter, Alexis; and son, Eddie Enrique.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Sean
('wod_sean', 'Sean', '10 rounds for time of:
11 chest-to-bar pull-ups
22 front squats

♀ 55 lb
♂ 75 lb

U.S. Army Staff Sgt. Sean M. Flannery, 29, of Wyomissing, Pennsylvania, assigned to the 2nd Battalion, 502nd Infantry Regiment, 2nd Brigade Combat Team, 101st Airborne Division (Air Assault), based in Fort Campbell, Kentucky, was killed on Nov. 22, 2010, in Kandahar Province, Afghanistan, when insurgents attacked his unit with an improvised explosive device.

He is survived by his fiancee, Christina Martin; mother, Charlene; and brothers, Sgt. Brian Flannery and Devin.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hortman
('wod_hortman', 'Hortman', 'Complete as many rounds as possible in 45 minutes of:
Run 800 meters
80 squats
8 muscle-ups

U.S. Army Capt. John D. Hortman, 30, of Inman, South Carolina, assigned to the 1st Battalion, 160th Special Operations Aviation Regiment, based in Fort Campbell, Kentucky, died on Aug. 8, 2011, in Fort Benning, Georgia, in a helicopter accident during a military training exercise.

He is survived by his mother, Brenda Jones; sister, Jill; and brother, Andy Pierce.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hamilton
('wod_hamilton', 'Hamilton', '3 rounds for time of:
Row 1,000 meters
50 push-ups
Run 1,000 meters
50 pull-ups

U.S. Army Spc. Adam Hamilton, 22, of Kent, Ohio, assigned to the 4th Squadron, 4th Cavalry Regiment, 1st Brigade Combat Team, 1st Infantry Division, based in Fort Riley, Kansas, died on May, 28, 2011 in Haji Ruf, Afghanistan, of wounds suffered when enemy forces attacked his unit with an improvised explosive device.

He is survived by his father, Scott; stepmother, Connie; mother, Nancy Krestan; brothers, Brandon and Nick Krestan; and sisters, Shawney and Taya.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Zeus
('wod_zeus', 'Zeus', '3 rounds for time of:
30 wall-ball shots
30 sumo deadlift high pulls
30 box jumps
30 push presses
30-calorie row
30 push-ups
10 back squats

♀ 14-lb medicine ball to a 9-foot target, 55-lb barbell, 20-inch box, bodyweight back squat
♂ 20-lb medicine ball to a 10-foot target, 75-lb barbell, 24-inch box, bodyweight back squat

U.S. Army Spc. David E. Hickman, 23, of Greensboro, North Carolina, assigned to the 2nd Battalion, 325th Airborne Infantry Regiment, 2nd Brigade Combat Team, 82nd Airborne Division, based in Fort Bragg, North Carolina, died on Nov. 14, 2011, in Baghdad, Iraq, from wounds suffered when insurgents detonated an improvised explosive device near his vehicle.

He is survived by his wife, Calli; parents, David and Veronica; and brother, Devon.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Barraza
('wod_barraza', 'Barraza', 'Complete as many rounds and reps as possible in 18 minutes of:
Run 200 meters
9 deadlifts
6 burpee bar muscle-ups

♀185 lb
♂ 275 lb

U.S. Army Staff Sgt. Ricardo Barraza, 24, of Shafter, California, assigned to the 2nd Battalion, 75th Ranger Regiment, based in Fort Lewis, Washington, died on March 18, 2006, in Ar Ramadi, Iraq, when he came under small-arms fire by enemy forces during combat operations.

He is survived by his parents, Francisco and Nina; his siblings, Amanda, Rachel, Jamie and Frankie; and his fiancee, Maghan K. Harrington and her daughter, Kayla.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Cameron
('wod_cameron', 'Cameron', 'For time:
50 walking lunge steps
25 chest-to-bar pull-ups
50 box jumps
25 triple-unders
50 back extensions
25 ring dips
50 knees-to-elbows
25 wall-ball shot "two-for-ones"
50 sit-ups
5 rope climbs to 15 feet

♀ 20-inch box, 14-lb medicine ball to a 9-foot target
♂ 24-inch box, 20-lb medicine ball to a 10-foot target

U.S. Coast Guard Lt. Junior Grade Thomas Cameron, 24, of Portland, Oregon, in training at the Aviation Training Center in Mobile, Alabama, died on Feb. 28, 2012, when his unit''s helicopter crashed into Mobile Bay in the Gulf of Mexico during a training mission.

He is survived by his parents, Bette and John; and brother, Alex.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jorge
('wod_jorge', 'Jorge', 'For time:
30 GHD sit-ups
15 squat cleans
24 GHD sit-ups
12 squat cleans
18 GHD sit-ups
9 squat cleans
12 GHD sit-ups
6 squat cleans
6 GHD sit-ups
3 squat cleans

♀ 105 lb
♂ 155 lb

U.S. Coast Guard Chief Petty Officer Fernando Jorge, 39, of Cypress, California, an Aviation Survival Technician Chief, died on Feb. 28, 2012, when his unit''s helicopter crashed into Mobile Bay in the Gulf of Mexico during a training mission.

He is survived by his sister, Gina.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Schmalls
('wod_schmalls', 'Schmalls', 'For time:
Run 800 meters
Then,
2 rounds of:
50 burpees
40 pull-ups
30 single-leg squats
20 kettlebell swings, 1/1.5 pood
10 handstand push-ups
Then,
Run 800 meters

♀ 35-lb kettlebell
♂ 53-lb kettlebell

U.S. Marine Corps Staff Sergeant Justin E. Schmalstieg, 28, of Pittsburgh, Pennsylvania, assigned to the 1st Explosive Ordnance Disposal Company, 7th Engineer Support Battalion, 1st Marine Logistics Group, I Marine Expeditionary Force, based in Camp Pendleton, California, died on December 15, 2010 while conducting combat operations in Helmand province, Afghanistan.

He is survived by his wife Ann Schneider, parents John and Deborah Gilkey, and brother John.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Brehm
('wod_brehm', 'Brehm', 'For time:
10 rope climbs to 15 feet
20 back squats
30 handstand push-ups
40-calorie row

♀ 155 lb
♂ 225 lb

U.S. Army Sgt. Dale G. Brehm, 23, of Turlock, California, assigned to the 2nd Battalion, 75th Ranger Regiment, based in Fort Lewis, Washington, died on March 18, 2006, when he came under small-arms fire from enemy forces during combat operations in Ar Ramadi, Iraq.

He is survived by his wife, Raini; father, William; stepmother, Linda; and mother, Laura Williams.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Omar
('wod_omar', 'Omar', 'For time:
10 thrusters
15 bar-facing burpees
20 thrusters
25 bar-facing burpees
30 thrusters
35 bar-facing burpees

♀ 65 lb
♂ 95 lb

U.S. Army 1st Lt. Omar Vazquez, 25, of Hamilton, New Jersey, assigned to the 2nd Squadron, 3rd Armored Cavalry Regiment, based in Fort Hood, Texas, died of wounds suffered April 22, 2011, when insurgents in Numaniyah, Iraq, attacked his unit with an improvised explosive device.

He is survived by his parents, Maria and Pablo; sister, Marisel; and brothers, Pablo and Javier.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gallant
('wod_gallant', 'Gallant', 'For time:
1-mile run with a medicine ball
60 burpee pull-ups
800-meter run with a medicine ball
30 burpee pull-ups
400-meter run with a medicine ball
15 burpee pull-ups

♀ 14-lb medicine ball
♂ 20-lb medicine ball

U.S. Navy Petty Officer 2nd Class Taylor Gallant, 22, of Winchester, Kentucky, assigned to the Explosive Ordnance Disposal Mobile Unit 12, based in Joint Expeditionary Base Little Creek in Virginia Beach, Virginia, died on Jan. 26, 2012, while conducting diving operations off the North Carolina coast in the Atlantic Ocean.

He is survived by his son, Ethan; brother, Kyle; mother, Elizabeth; and father, Joseph.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bruck
('wod_bruck', 'Bruck', '4 rounds for time of:
400-meter run
24 back squats
24 jerks

♀ 125-lb back squat, 95-lb jerk
♂ 185-lb back squat, 135-lb jerk

U.S. Coast Guard Petty Officer 3rd Class Nathan B. Bruckenthal, 24, of Smithtown, New York, assigned to Tactical Law Enforcement Team South, Law Enforcement Detachment 403, based at Coast Guard Air Station Miami in Florida, was killed on April 24, 2004, at the Khawr Al Amaya Oil Terminal off the coast of Iraq when a boat that he and his team intercepted near the terminal exploded.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Eighth batch Hero workouts  
-- Smykowski
('wod_smykowski', 'Smykowski', 'For time:
Run 6K
60 burpee pull-ups

If you''ve got body armor or a 30-lb vest, wear it.

U.S. Marine Corps Sgt. Mark T. Smykowski, 23, of Mentor, Ohio, assigned to 2nd Reconnaissance Battalion, 2nd Marine Division, II Marine Expeditionary Force, based in Camp Lejeune, North Carolina, was killed on June 6, 2006, while conducting combat operations in Al Anbar Province, Iraq.

He is survived by his mother, Diana Ross; father, Bert; and brothers, Darren and Kenny, both Marines.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Falkel
('wod_falkel', 'Falkel', 'Complete as many rounds and reps as possible in 25 minutes of:
8 handstand push-ups
8 box jumps
1 rope climb to 15 feet

♀ 24-inch box
♂ 30-inch box

U.S. Army Staff Sgt. Chris Falkel, 22, of Highlands Ranch, Colorado, assigned to the 1st Battalion, 3rd Special Forces Group, based in Fort Bragg, North Carolina, was killed on Aug. 8, 2005 by enemy small-arms fire in Deh Afghan, Afghanistan.

He is survived by his parents, Jeff and Dianne Falkel.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Donny
('wod_donny', 'Donny', '21-15-9-9-15-21 reps for time of:
Deadlifts
Burpees

♀ 155 lb
♂ 225 lb

U.S. Army Spc. Donald L. Nichols, 21, of Shell Rock, Iowa, assigned to the 1st Battalion, 133rd Infantry Regiment, Iowa Army National Guard, based in Waterloo, Iowa, died April 13, 2011, in Laghman Province, Afghanistan, of wounds suffered when insurgents attacked his unit using an improvised explosive device.

He is survived by his mother and stepfather, Roger and Becky Poock; father and stepmother, Jeff and Jeanie; and his brothers, Nick and Joe.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Dobogai
('wod_dobogai', 'Dobogai', '7 rounds for time of:
8 muscle-ups
22-yard farmers carry

♀ 35-lb dumbbells
♂ 50-lb dumbbells

U.S. Army Capt. Derek A. Dobogai, 26, of Fond Du Lac, Wisconsin, assigned to the 2nd Battalion, 35th Infantry Regiment, 3rd Infantry Brigade Combat Team, 25th Infantry Division, based in Schofield Barracks, Hawaii, died on Aug. 22, 2007, in Multaka, Iraq, of injuries suffered when his unit''s helicopter crashed.

He is survived by his parents, David and Lisa; and brothers, Daniel and David Jr.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hotshots 19
('wod_hotshots_19', 'Hotshots 19', '6 rounds for time of:
30 squats
19 power cleans
7 strict pull-ups
400-meter run

♀ 95-lb barbell
♂ 135-lb barbell

On June 30, 2013, 19 members of the Granite Mountain Hotshots firefighting team tragically lost their lives while fighting a fire in Yarnell, Arizona.

Hotshots 19 honors the memory of these 19 heroes.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Roney
('wod_roney', 'Roney', '4 rounds for time of:
200-meter run
11 thrusters
200-meter run
11 push presses
200-meter run
11 bench presses

♀ 95-lb barbell
♂ 135-lb barbell

Police Service of Northern Ireland Constable Ronan Kerr, 25, of Omagh, Northern Ireland, was killed on April 2, 2011, by a car bomb outside his home in Omagh.

He is survived by his mother, Nuala; brothers, Cathair and Aaron; and sister, Dairine.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- The Don
('wod_the_don', 'The Don', 'For time:
66 deadlifts
66 box jump
66 kettlebell swings
66 knees-to-elbows
66 sit-ups
66 pull-ups
66 thrusters
66 wall-ball shots
66 burpees
66 double-unders

♀ 70-lb deadlift, 20-inch box, 35-lb kettlebell, 35-lb thruster, 14-lb medicine ball to a 9-foot target
♂ 110-lb deadlift, 24-inch box, 53-lb kettlebell, 55-lb thruster, 20-lb medicine ball to a 10-foot target

U.S. Marine Cpl. Donald M. Marler, 22, of St. Louis, Missouri, assigned to the 3rd Battalion, 1st Marine Regiment, 1st Marine Division, I Marine Expeditionary Force, based in Camp Pendleton, California, died on June 6, 2010, while supporting combat operations in Helmand Province, Afghanistan.

He is survived by his mother, Susan; his father, David Sr.; his sister, Jennifer Pupillo; and his brothers, David Jr. and Jacob.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Continuing eighth batch with more Hero workouts
-- Dragon
('wod_dragon', 'Dragon', 'For time:
Run 5K
4 minutes to find 4-rep-max deadlift
Run 5K
4 minutes to find 4-rep-max push jerk

U.S. Army Capt. Nicholas Rozanski, 36, of Dublin, Ohio, assigned to the 1st Battalion, 148th Infantry Regiment, 37th Infantry Brigade Combat Team, of the Ohio National Guard, based in Walbridge, Ohio, died on April 4, 2012, of wounds sustained during an enemy attack in Faryab province, Afghanistan.

He is survived by his wife, Jennifer; daughters, Emma and Anna; mother, Pamela Mitchell; father, Jan; and brothers Keith and Alex.', 'load', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Walsh
('wod_walsh', 'Walsh', '4 rounds for time of:
22 burpee pull-ups
22 back squats
200-meter run with a plate overhead

♀ 125-lb barbell, 25-lb plate
♂ 185-lb barbell, 45-lb plate

U.S. Army 1st Lt. Jonathan P. Walsh, 28, of Cobb, Georgia, assigned to the 2nd Battalion, 504th Infantry, 1st Brigade Combat Team, 82nd Airborne Division, based in Fort Bragg, North Carolina, died on April 22, 2012, in Paktia, Afghanistan, when enemy forces attacked his unit with an improvised explosive device.

He is survived by his wife, Debbra; son, Austin; parents, Carolyn and Paul; and brother, Christopher.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Lee
('wod_lee', 'Lee', '5 rounds for time of:
400-meter run
1 deadlift
3 squat cleans
5 push jerks
3 muscle-ups
1 rope climb to 15 feet

♀ 225-lb deadlift, 125-lb squat clean, 125-lb push jerk
♂ 345-lb deadlift, 185-lb squat clean, 185-lb push jerk

U.S. Army Staff Sgt. Dick Alson Lee Jr., 31, of Orange Park, Florida, assigned to the 95th Military Police Battalion, 18th Military Police Brigade, 21st Theater Sustainment Command, based in Sembach, Germany, died on April 26, 2012, from injuries sustained when his vehicle encountered an improvised explosive device in Ghazni Province, Afghanistan.

He is survived by his wife, Katherine; sons, Joshua and David; mother, Brenda, and her husband, Larry Carroll; father, Dick Sr.; sister, Specialist Vanessa Compton; and brother, Michael Carroll.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Willy
('wod_willy', 'Willy', '3 rounds for time of:
800-meter run
5 front squats
200-meter run
11 chest-to-bar pull-ups
400-meter run
12 kettlebell swings

♀ 155-lb barbell, 53-lb kettlebell
♂ 225-lb barbell, 70-lb kettlebell

U.S. Marine Corps Sgt. Wade D. Wilson, 22, of Normangee, Texas, assigned to the 2nd Battalion, 5th Marine Regiment, 1st Marine Division, I Marine Expeditionary Force, based in Camp Pendleton, California, died on May 11, 2012, while conducting combat operations in Helmand Province, Afghanistan.

He is survived by his mother and stepfather, Cindy Lee and Ward Easterling; father and stepmother, Mitchell Boyd and Tammy; brothers, Chad, Alex and Curtis; and sister, Layne.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Coffey
('wod_coffey', 'Coffey', 'For time:
800-meter run
50 back squats
50 bench presses
800-meter run
35 back squats
35 bench presses
800-meter run
20 back squats
20 bench presses
800-meter run
1 muscle-up

♀ 95 lb
♂ 135 lb

U.S. Marine Cpl. Keaton G. Coffey, 22, of Boring, Oregon, assigned to the 1st Law Enforcement Battalion, 1st Marine Headquarters Group, 1st Marine Expeditionary Force, based in Camp Pendleton, California, was killed on May 24, 2012, while conducting combat operations in Helmand Province, Afghanistan.

He is survived by his fiancee, Brittany Dygert; and his parents, Grant and Inger.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Continuing with more Hero workouts (next 10)
-- DG
('wod_dg', 'DG', 'Complete as many rounds and reps as possible in 10 minutes of:
8 toes-to-bars
8 dumbbell thrusters
12 dumbbell walking lunges

♀ 20-lb dumbbells
♂ 35-lb dumbbells

U.S. Air Force Maj. Walter David Gray, 38, of Conyers, Georgia, assigned to the 13th Air Support Operations Squadron, based in Fort Carson, Colorado, died on Aug. 8, 2012, from injuries suffered during a suicide-bomb attack in Kunar Province, Afghanistan.

He is survived by his wife, Heather; daughters, Nyah and Ava; and son, Garrett.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- TK
('wod_tk', 'TK', 'Complete as many rounds and reps as possible in 20 minutes of:
8 strict pull-ups
8 box jumps
12 kettlebell swings

♀ 30-inch box, 53-lb kettlebell
♂ 36-inch box, 70-lb kettlebell

U.S. Army Major Thomas E. Kennedy, 35, of West Point, New York, assigned to Headquarters and Headquarters Company, 4th Brigade Combat Team, 4th Infantry Division, based in Fort Carson, Colorado, died on Aug. 8, 2012, of wounds suffered when an insurgent detonated a suicide vest in Kunar Province, Afghanistan.

He is survived by his wife, Kami; son, Brody; daughter, Margaret; parents, George and Patricia; and brothers, John and George.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Taylor
('wod_taylor', 'Taylor', '4 rounds for time of:
400-meter run
5 burpee muscle-ups

If you''ve got a weighted vest or body armor, wear it.

♀ 14-lb vest
♂ 20-lb vest

U.S. Army Specialist David Wayne Taylor, 20, of Dixon, Kentucky, assigned to the 2nd Battalion, 508th Parachute Infantry Regiment, 4th Brigade Combat Team, 82nd Airborne Division, based in Fort Bragg, North Carolina, died in Kandahar province, Afghanistan on March 29, 2012, from wounds sustained in an accident at an ammunition supply point.

He is survived by his sisters Tamara Taylor and Christina Abell, and mother Sarah Whitledge Taylor.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Justin
('wod_justin', 'Justin', '30-20-10 reps for time of:
Bodyweight back squats
Bodyweight bench presses
Strict pull-ups

U.S. Marine Corps Sgt. Justin M. Hansen, 26, of Traverse City, Michigan, assigned to the 2nd Marine Special Operations Battalion, based in Camp Lejeune, North Carolina, died July 24, 2012, in Badghis Province, Afghanistan, while conducting combat operations.

He is survived by his parents, Vickie Hayes and Richard; stepmother, Shawna; stepfather, Steven C. Cornell; sisters, Adrienne Russell, Morgan Compton and Veronica Compton; stepbrothers, Jeremy Borey and Adam Cornell; and stepsister, Jessica Borey.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nukes
('wod_nukes', 'Nukes', '8 minutes to complete:
1-mile run
Max reps deadlifts

Then, 10 minutes to complete:
1-mile run
Max reps power cleans

Then, 12 minutes to complete:
1-mile run
Max reps overhead squats

Do not rest between rounds.

♀ 205-lb deadlift, 155-lb power clean, 95-lb overhead squat
♂ 315-lb deadlift, 225-lb power clean, 135-lb overhead squat

U.S. Marine Corps Capt. Matthew "Nukes" Manoukian, 29, of Los Altos Hills, California, assigned to the 1st Marine Special Operations Battalion, based in Camp Pendleton, California, died Aug. 10, 2012, in Sangin District, Afghanistan, after being shot by an Afghan policeman.

He is survived by his parents, Socrates Peter and Patricia; and his brothers, Mike and Marty.', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Zembiec
('wod_zembiec', 'Zembiec', '5 rounds for time of:
11 back squats
7 strict burpee pull-ups
400-meter run

♀ 125-lb barbell
♂ 185-lb barbell

During each burpee pull-up perform a strict push-up, jump to a bar that is ideally 12 inches above your max standing reach, and perform a strict pull-up.

U.S. Marine Corps Maj. Douglas A. Zembiec, 34, of Albuquerque, New Mexico, assigned to Headquarters Battalion, Marine Corps National Capital Region, Henderson Hall, based in Arlington, Virginia, was killed during a firefight on May 11, 2007, in Baghdad, Iraq.

He is survived by his wife, Pamela; daughter, Fallyn; parents, Donald and Jo Ann; and brother, John.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Alexander
('wod_alexander', 'Alexander', '5 rounds for time of:
31 back squats
12 power cleans

♀ 95-lb back squat, 125-lb power clean
♂ 135-lb back squat, 185-lb power clean

Staff Sgt. Alexander G. Povilaitis, 47, of Dawsonville, Gerogia, assigned to the 570th Sapper Company, 14th Engineer Battalion, 555th Brigade, was killed in action on May 31, 2012, in Kandahar Province, Afghanistan, when enemy forces attacked his vehicle with an improvised explosive device.

He is survived by his wife, Kimberly; and two sons, Alexander Blaine and Danny.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wyk
('wod_wyk', 'Wyk', '5 rounds for time of:
5 front squats
5 rope climbs to 15 feet
400-meter run with a plate

♀ 155-lb barbell, 25-lb plate
♂ 225-lb barbell, 45-lb plate

Army Pfc. Jacob H. "Wyk" Wykstra, 21, of Thornton, Colorado, assigned to 1st Battalion, 12th Infantry Regiment, 4th Brigade Combat Team, 4th Infantry Division, died May 28, 2014, in Kandahar Province, Afghanistan, of injuries sustained in an aircraft accident.

He is survived by his wife, Katie Wykstra; mother, Heidi Katzenbach; father, Thomas Wykstra; brothers, Aiden and Connor Wykstra; sister, Hannah Donato; stepfather Ray Katzenbach; and stepmother, Joyce Wykstra.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bell
('wod_bell', 'Bell', '3 rounds for time of:
21 deadlifts
15 pull-ups
9 front squats

♀ 125-lb barbell
♂ 185-lb barbell

Air Force Senior Airman Bryan R. Bell, 23, of Erie, Pennsylvania, assigned to 2nd Civil Engineer Squadron at Barksdale Air Force Base, Louisiana, died Jan. 5, 2012, at Camp Bastion in Afghanistan, of injuries suffered when his vehicle struck an improvised explosive device.

He is survived by his wife, Alaina; parents, Richard Bell and Brenda Hart; sister, Candice; stepfather, David Aldrich; stepmother, Kim; stepsister, Stephanie Battista; stepbrother, Matthew Aldrich; maternal grandparents, Ross and Gertrude Peters; paternal grandmother, Carmen; mother- and father-in-law, Mike and Brenda Hart; sister- and brother-in-law, Mariel and Patrick Wilcox; and several aunts, uncles and cousins.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- JBo
('wod_jbo', 'JBo', 'Complete as many rounds and reps as possible in 28 minutes of:
9 overhead squats
1 legless rope climb to 15 feet, beginning from seated
12 bench presses

♀ 75-lb barbell
♂ 115-lb barbell

U.S. Army Staff Sgt. Jeremie "JBo" "Bubba" Border, 28, of Mesquite, Texas, assigned to the 1st Battalion, 1st Special Forces Group (Airborne), based in Torii Station, Okinawa, Japan, died Sept. 1, 2012, in Batur Village, Afghanistan, from wounds suffered when enemy forces attacked his unit with small-arms fire.

He is survived by his parents, Mary Border and Robert Harris; sisters, DeLaynie Peek, Katie Border, Ashley Harris and Amanda Pereira; nephews, Robbie and Kayden Pereira; and brothers-in-law, Jason Peek and Roberto Pereira.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Adding final batch of Hero workouts to complete the set
-- Kevin
('wod_kevin', 'Kevin', '3 rounds for time of:
32 deadlifts
32 hanging hip touches, alternating arms
800-meter running farmers carry

♀ 125-lb barbell, 10-lb dumbbells
♂ 185-lb barbell, 15-lb dumbbells

Navy Special Warfare Operator 1st Class Kevin Ebbert, 32, of Arcata, California, assigned to an East Coast-based Naval Special Warfare unit in Virginia Beach, Virginia, died Nov. 24, 2012, in Uruzgan Province, Afghanistan, while supporting combat stability operations.

Ebbert is survived by his wife, Ursula; mother, Charlie Jordan; sister, Samantha Ebbert Martinez; stepsisters, Amy Funk and Kate Renner; stepfather, Mark Ritz; and grandfathers, Richard Ebbert and James Jordan. He was preceded in death by his father, Jeffrey, a retired Navy SEAL.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Rocket
('wod_rocket', 'Rocket', 'Complete as many rounds as possible in 30 minutes of:
50-yard swim
10 push-ups
15 squats

U.S. Army Sgt. 1st Class Aaron "Rocket" Henderson, 33, of Houlton, Maine, assigned to the 2nd Battalion, 5th Special Forces Group (Airborne), died Oct. 2, 2012, at Bagram Air Base, Afghanistan, of wounds suffered from an improvised explosive device in Zombalay Village, Afghanistan.

Henderson is survived by his mother, Christine; brothers, Bob, Corey and Sam; sisters-in-law, Leisa, Holly and Kiley; and nephews and nieces, Kurtis, Kaitlyn, Davis, Dallas, Mia and Daniel. He is preceded in death by his father, Dallas.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Riley
('wod_riley', 'Riley', 'For time:
Run 1.5 miles
150 burpees
Run 1.5 miles

If you''ve got a weight vest or body armor, wear it.

Army Sgt. 1st Class Riley G. Stephens, 39, of Tolar, Texas, assigned to the 1st Battalion, 3rd Special Forces Group (Airborne), died Sept. 28, 2012, in Wardak, Afghanistan, of wounds caused by enemy small-arms fire.

Stephens is survived by his wife, Tiffany; three children, Austin, Morgan and Rylee Ann; parents, Michael and Joann; brother, Ken; and a number of family members.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Spehar
('wod_spehar', 'Spehar', 'For time:
100 thrusters
100 chest-to-bar pull-ups
Run 6 miles

Partition the thrusters, pull-ups, and run as needed.

♀ 95 lb
♂ 135 lb

U.S. Navy Special Warfare Operator Petty Officer 2nd Class (SEAL) Nicholas Spehar died Aug. 6, 2011, in Wardak Province, Afghanistan, of wounds suffered when his helicopter was shot down. The 24-year-old, of St. Paul, Minnesota, was assigned to a West Coast-based Naval Special Warfare unit and served during Operation Enduring Freedom.

Spehar is survived by his parents, Patrick and Annette; and siblings, Luke, Jacob and Lisa, and Marie Mielke.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Luke
('wod_luke', 'Luke', 'For time:
Run 400 meters
15 clean and jerks
Run 400 meters
30 toes-to-bars
Run 400 meters
45 wall-ball shots
Run 400 meters
45 kettlebell swings
Run 400 meters
30 ring dips
Run 400 meters
15 front-rack weighted lunges
Run 400 meters

♀ 105-lb barbell, 14-lb medicine ball to a 9-foot target, 35-lb kettlebell
♂ 155-lb barbell, 20-lb medicine ball to a 10-foot target, 53-lb kettlebell

Marine Staff Sgt. Leon H. Lucas Jr. died Aug. 1, 2011, in Helmand Province, Afghanistan, of injuries sustained from an enemy grenade attack in the upper Gereshk Valley. The 32-year-old, of Wilson, North Carolina, was assigned to the 3rd Battalion, 4th Marine Regiment, Twentynine Palms, California, and served during Operation Enduring Freedom.

Lucas is survived by his wife, Mary; and children, Tyson, Zachary and Quentin.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Robbie
('wod_robbie', 'Robbie', 'Complete as many rounds as possible in 25 minutes of:
8 freestanding handstand push-ups
15-foot L-sit rope climb, 1 ascent

U.S. Army Staff Sergeant Robert J. Miller died Jan. 25, 2008, in Bari Kowt, Afghanistan, of wounds sustained when he encountered small-arms fire while conducting combat operations. The 24-year-old, of Oviedo, Florida, was assigned to the 3rd Battalion, 3rd Special Forces Group (Airborne) in Fort Bragg, North Carolina, and served during Operation Enduring Freedom. In October of 2010, Miller was awarded the Medal of Honor posthumously for his heroic actions in combat.

Miller is survived by his parents, Philip and Maureen; brothers, Thomas, Martin and Edward; and sisters, Joanna, Mary, Therese and Patricia.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Topsy (final workout)
('wod_topsy', 'TOPSY', 'Complete as many rounds and reps as possible in 25 minutes of:
3 ring muscle-ups
8 thrusters
17-calorie row

♀ 75 lb
♂ 115 lb

McCoy "Topsy" Turner, a loved member of the CrossFit community and former Seminar Staff trainer, died by suicide on March 8, 2025, after suffering from complex post-traumatic stress.

Turner served for 17 years in the Royal Navy, specializing as an exercise rehabilitation instructor. He was part of Operation Herrick when he served in Afghanistan before relocating to Bali and continuing his work in CrossFit education. Turner worked more than 250 Level 1 and Level 2 Seminars.

Turner was known for his warmth and kindness, and touched countless lives who attended CrossFit courses. He is survived by his sons Brodie and Tommy.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hidalgo
('wod_hidalgo', 'Hidalgo', 'For time:
Run 2 miles
Rest 2 minutes
20 squat cleans
20 box jumps
20 overhead walking lunges
20 box jumps
20 squat cleans
Rest 2 minutes
Run 2 miles

♀ 95-lb barbell, 20-inch box, 25-lb plate
♂ 135-lb barbell, 24-inch box, 45-lb plate

If you''ve got a 20-lb vest or body armor, wear it.

U.S. Army 1st Lt. Daren M. Hidalgo, 24, of Waukesha, Wisconsin, assigned to 3rd Squadron, 2nd Stryker Cavalry Regiment, based in Vilseck, Germany, died on Feb. 20, 2011, in Kandahar Province, Afghanistan, from wounds suffered when insurgents attacked his unit with an improvised explosive device. Two weeks prior to his death, he was hit by an earlier improvised explosive device. Despite his injuries, he stayed in the country and on patrols rather than return home.

He is survived by his father, Jorge; mother, Andrea; brothers, Miles and Jared; and sister, Carmen.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ricky
('wod_ricky', 'Ricky', 'Complete as many rounds as possible in 20 minutes of:
10 pull-ups
5 dumbbell deadlifts
8 push presses

♀ 50-lb dumbbells, 95-lb barbell
♂ 75-lb dumbbells, 135-lb barbell

U.S. Army Sgt. William "Ricky" Rudd, 27, of Madisonville, Kentucky, assigned to the 3rd Battalion, 75th Ranger Regiment, based in Fort Benning, Georgia, died on Oct. 5, 2008, from wounds suffered from enemy small arms fire while on a combat patrol in Mosul, Iraq.

He is survived by his father, William; stepmother, Barbara Rudd; stepbrother, Josh; mother, Pamela Lam; and sister, Elizabeth.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Dae Han
('wod_dae_han', 'Dae Han', '3 rounds for time of:
Run 800 meters with an empty barbell
3 rope climbs
12 thrusters

♀ 15-foot rope climb, 95-lb thrusters
♂ 15-foot rope climb, 135-lb thrusters

U.S. Army Sgt. First Class Dae Han Park, 36, of Watertown, Connecticut, assigned to the 3rd Battalion, 1st Special Forces Group (Airborne), based out of Joint Base Lewis-McChord, Washington, died on March 12, 2011, in Wardak Province, Afghanistan, from wounds suffered when enemy forces attacked his unit with an improvised explosive device.

He is survived by his wife, Mi Kyong; daughters, Niya and Sadie; parents, Joseph and Bonnie; and siblings, Katie and Saejin.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Desforges
('wod_desforges', 'Desforges', '5 rounds for time of:
12 deadlifts
20 pull-ups
12 clean and jerks
20 knees-to-elbows

♀ 155-lb deadlifts, 95-lb clean and jerks
♂ 225-lb deadlifts, 135-lb clean and jerks

U.S. Marine Corps Sgt. Joshua Desforges, 23, of Ludlow, Massachusetts, assigned to 1st Battalion, 6th Marine Regiment, 2nd Marine Division, II Marine Expeditionary Force, based in Camp Lejeune, North Carolina, was killed on May 12, 2010, while supporting combat operations in Helmand Province, Afghanistan.

He is survived by his parents, David and Arlene; and his loving sister, Janelle.', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Rahoi
('wod_rahoi', 'Rahoi', 'Complete as many rounds as possible in 12 minutes of:
12 box jumps
6 thrusters
6 bar-facing burpees

♀ 20-inch box, 65-lb thrusters
♂ 24-inch box, 95-lb thrusters

U.S. FBI Supervisory Special Agent Gregory J. Rahoi, 38, of Brookfield, Wisconsin, assigned to the Hostage Rescue Team, based in Quantico, Virginia, was killed on Dec. 6, 2006, during a live-fire tactical training exercise at Fort A.P. Hill, near Bowling Green, Virginia.

He is survived by his parents, Natalie and Richard; sister, Teri; and fiancee, Paula Paulk.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Zimmerman
('wod_zimmerman', 'Zimmerman', 'Complete as many rounds and reps as possible in 25 minutes of:
11 chest-to-bar pull-ups
2 deadlifts
10 handstand push-ups

♀ 205 lb
♂ 315 lb

U.S. Marine Corps 1st Lt. James R. Zimmerman, 25, of Aroostook, Maine, assigned to 2nd Battalion, 6th Marine Regiment, 2nd Marine Division, II Marine Expeditionary Force, based in Camp Lejeune, North Carolina, died on Nov. 2, 2010, while conducting combat operations in Helmand Province, Afghanistan.

He is survived by his wife, Lynel Winters; parents, Tom and Jane; sister, Megan; and brother, Christian.', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Note: This script now contains 137 Hero workouts - a comprehensive collection of CrossFit Hero WODs.
-- This represents a substantial portion of the official CrossFit Hero workout catalog.
-- Additional Hero workouts can be added following the same pattern in future updates.

-- Tag all workouts as Hero benchmarks
INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES 
('wtag_jt_hero', 'wod_jt', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jt_benchmark', 'wod_jt', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_michael_hero', 'wod_michael', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_michael_benchmark', 'wod_michael', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_murph_hero', 'wod_murph', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_murph_benchmark', 'wod_murph', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_daniel_hero', 'wod_daniel', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_daniel_benchmark', 'wod_daniel', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_josh_hero', 'wod_josh', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_josh_benchmark', 'wod_josh', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jason_hero', 'wod_jason', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jason_benchmark', 'wod_jason', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_badger_hero', 'wod_badger', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_badger_benchmark', 'wod_badger', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_joshie_hero', 'wod_joshie', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_joshie_benchmark', 'wod_joshie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nate_hero', 'wod_nate', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nate_benchmark', 'wod_nate', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nate_amrap', 'wod_nate', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_randy_hero', 'wod_randy', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_randy_benchmark', 'wod_randy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tommy_v_hero', 'wod_tommy_v', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tommy_v_benchmark', 'wod_tommy_v', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_griff_hero', 'wod_griff', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_griff_benchmark', 'wod_griff', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ryan_hero', 'wod_ryan', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ryan_benchmark', 'wod_ryan', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_erin_hero', 'wod_erin', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_erin_benchmark', 'wod_erin', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mr_joshua_hero', 'wod_mr_joshua', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mr_joshua_benchmark', 'wod_mr_joshua', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_dt_hero', 'wod_dt', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_dt_benchmark', 'wod_dt', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_danny_hero', 'wod_danny', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_danny_benchmark', 'wod_danny', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_danny_amrap', 'wod_danny', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hansen_hero', 'wod_hansen', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hansen_benchmark', 'wod_hansen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tyler_hero', 'wod_tyler', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tyler_benchmark', 'wod_tyler', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_lumberjack_20_hero', 'wod_lumberjack_20', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_lumberjack_20_benchmark', 'wod_lumberjack_20', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_lumberjack_20_chipper', 'wod_lumberjack_20', 'tag_chipper', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_stephen_hero', 'wod_stephen', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_stephen_benchmark', 'wod_stephen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_garrett_hero', 'wod_garrett', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_garrett_benchmark', 'wod_garrett', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_war_frank_hero', 'wod_war_frank', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_war_frank_benchmark', 'wod_war_frank', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mcghee_hero', 'wod_mcghee', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mcghee_benchmark', 'wod_mcghee', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mcghee_amrap', 'wod_mcghee', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_paul_hero', 'wod_paul', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_paul_benchmark', 'wod_paul', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jerry_hero', 'wod_jerry', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jerry_benchmark', 'wod_jerry', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nutts_hero', 'wod_nutts', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nutts_benchmark', 'wod_nutts', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nutts_chipper', 'wod_nutts', 'tag_chipper', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_arnie_hero', 'wod_arnie', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_arnie_benchmark', 'wod_arnie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_the_seven_hero', 'wod_the_seven', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_the_seven_benchmark', 'wod_the_seven', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rj_hero', 'wod_rj', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rj_benchmark', 'wod_rj', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_luce_hero', 'wod_luce', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_luce_benchmark', 'wod_luce', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_johnson_hero', 'wod_johnson', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_johnson_benchmark', 'wod_johnson', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_johnson_amrap', 'wod_johnson', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_roy_hero', 'wod_roy', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_roy_benchmark', 'wod_roy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_adambrown_hero', 'wod_adambrown', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_adambrown_benchmark', 'wod_adambrown', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_coe_hero', 'wod_coe', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_coe_benchmark', 'wod_coe', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- New Hero workouts tags
('wtag_severin_hero', 'wod_severin', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_severin_benchmark', 'wod_severin', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_helton_hero', 'wod_helton', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_helton_benchmark', 'wod_helton', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jack_hero', 'wod_jack', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jack_benchmark', 'wod_jack', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jack_amrap', 'wod_jack', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_forrest_hero', 'wod_forrest', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_forrest_benchmark', 'wod_forrest', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bulger_hero', 'wod_bulger', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bulger_benchmark', 'wod_bulger', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brenton_hero', 'wod_brenton', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brenton_benchmark', 'wod_brenton', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_blake_hero', 'wod_blake', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_blake_benchmark', 'wod_blake', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Second batch Hero workouts tags
('wtag_collin_hero', 'wod_collin', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_collin_benchmark', 'wod_collin', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_thompson_hero', 'wod_thompson', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_thompson_benchmark', 'wod_thompson', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_whitten_hero', 'wod_whitten', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_whitten_benchmark', 'wod_whitten', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bull_hero', 'wod_bull', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bull_benchmark', 'wod_bull', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rankel_hero', 'wod_rankel', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rankel_benchmark', 'wod_rankel', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rankel_amrap', 'wod_rankel', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_holbrook_hero', 'wod_holbrook', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_holbrook_benchmark', 'wod_holbrook', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ledesma_hero', 'wod_ledesma', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ledesma_benchmark', 'wod_ledesma', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ledesma_amrap', 'wod_ledesma', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wittman_hero', 'wod_wittman', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wittman_benchmark', 'wod_wittman', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mccluskey_hero', 'wod_mccluskey', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mccluskey_benchmark', 'wod_mccluskey', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Third batch Hero workouts tags
('wtag_weaver_hero', 'wod_weaver', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_weaver_benchmark', 'wod_weaver', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_abbate_hero', 'wod_abbate', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_abbate_benchmark', 'wod_abbate', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hammer_hero', 'wod_hammer', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hammer_benchmark', 'wod_hammer', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_moore_hero', 'wod_moore', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_moore_benchmark', 'wod_moore', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_moore_amrap', 'wod_moore', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wilmot_hero', 'wod_wilmot', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wilmot_benchmark', 'wod_wilmot', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_moon_hero', 'wod_moon', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_moon_benchmark', 'wod_moon', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_small_hero', 'wod_small', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_small_benchmark', 'wod_small', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_morrison_hero', 'wod_morrison', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_morrison_benchmark', 'wod_morrison', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_manion_hero', 'wod_manion', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_manion_benchmark', 'wod_manion', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gator_hero', 'wod_gator', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gator_benchmark', 'wod_gator', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Fourth batch Hero workouts tags
('wtag_bradley_hero', 'wod_bradley', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bradley_benchmark', 'wod_bradley', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_meadows_hero', 'wod_meadows', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_meadows_benchmark', 'wod_meadows', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_santiago_hero', 'wod_santiago', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_santiago_benchmark', 'wod_santiago', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_carse_hero', 'wod_carse', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_carse_benchmark', 'wod_carse', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bradshaw_hero', 'wod_bradshaw', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bradshaw_benchmark', 'wod_bradshaw', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_white_hero', 'wod_white', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_white_benchmark', 'wod_white', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_santora_hero', 'wod_santora', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_santora_benchmark', 'wod_santora', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wood_hero', 'wod_wood', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_wood_benchmark', 'wod_wood', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Sixth batch Hero workout tags
('wtag_klepto_hero', 'wod_klepto', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_klepto_benchmark', 'wod_klepto', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_del_hero', 'wod_del', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_del_benchmark', 'wod_del', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_pheezy_hero', 'wod_pheezy', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_pheezy_benchmark', 'wod_pheezy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jj_hero', 'wod_jj', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jj_benchmark', 'wod_jj', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jag_28_hero', 'wod_jag_28', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jag_28_benchmark', 'wod_jag_28', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brian_hero', 'wod_brian', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brian_benchmark', 'wod_brian', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nick_hero', 'wod_nick', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nick_benchmark', 'wod_nick', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_strange_hero', 'wod_strange', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_strange_benchmark', 'wod_strange', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tumilson_hero', 'wod_tumilson', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tumilson_benchmark', 'wod_tumilson', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ship_hero', 'wod_ship', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ship_benchmark', 'wod_ship', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jared_hero', 'wod_jared', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jared_benchmark', 'wod_jared', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tully_hero', 'wod_tully', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tully_benchmark', 'wod_tully', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_holleyman_hero', 'wod_holleyman', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_holleyman_benchmark', 'wod_holleyman', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- New Hero workout tags (Hidalgo, Ricky, Dae Han, Desforges, Rahoi, Zimmerman)
('wtag_hidalgo_hero', 'wod_hidalgo', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hidalgo_benchmark', 'wod_hidalgo', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ricky_hero', 'wod_ricky', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ricky_benchmark', 'wod_ricky', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_dae_han_hero', 'wod_dae_han', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_dae_han_benchmark', 'wod_dae_han', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_desforges_hero', 'wod_desforges', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_desforges_benchmark', 'wod_desforges', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rahoi_hero', 'wod_rahoi', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_rahoi_benchmark', 'wod_rahoi', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_zimmerman_hero', 'wod_zimmerman', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_zimmerman_benchmark', 'wod_zimmerman', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Seventh batch Hero workout tags
('wtag_adrian_hero', 'wod_adrian', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_adrian_benchmark', 'wod_adrian', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_glen_hero', 'wod_glen', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_glen_benchmark', 'wod_glen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tom_hero', 'wod_tom', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_tom_benchmark', 'wod_tom', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ralph_hero', 'wod_ralph', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_ralph_benchmark', 'wod_ralph', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_clovis_hero', 'wod_clovis', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_clovis_benchmark', 'wod_clovis', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_weston_hero', 'wod_weston', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_weston_benchmark', 'wod_weston', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_loredo_hero', 'wod_loredo', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_loredo_benchmark', 'wod_loredo', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_sean_hero', 'wod_sean', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_sean_benchmark', 'wod_sean', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hortman_hero', 'wod_hortman', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hortman_benchmark', 'wod_hortman', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hamilton_hero', 'wod_hamilton', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hamilton_benchmark', 'wod_hamilton', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_zeus_hero', 'wod_zeus', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_zeus_benchmark', 'wod_zeus', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_barraza_hero', 'wod_barraza', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_barraza_benchmark', 'wod_barraza', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_cameron_hero', 'wod_cameron', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_cameron_benchmark', 'wod_cameron', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jorge_hero', 'wod_jorge', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jorge_benchmark', 'wod_jorge', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_schmalls_hero', 'wod_schmalls', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_schmalls_benchmark', 'wod_schmalls', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brehm_hero', 'wod_brehm', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_brehm_benchmark', 'wod_brehm', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_omar_hero', 'wod_omar', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_omar_benchmark', 'wod_omar', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gallant_hero', 'wod_gallant', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gallant_benchmark', 'wod_gallant', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bruck_hero', 'wod_bruck', 'tag_hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_bruck_benchmark', 'wod_bruck', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create workout movements relationships (using existing movement IDs from seed.sql)
INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES 
-- JT: Handstand push-ups, Ring dips, Push-ups
('wm_jt_hspu', 'wod_jt', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jt_ringdip', 'wod_jt', 'mov_ringdip', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jt_pushup', 'wod_jt', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Michael: Run, Back extensions, Sit-ups
('wm_michael_run', 'wod_michael', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_michael_situp', 'wod_michael', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Murph: Run, Pull-ups, Push-ups, Squats
('wm_murph_run', 'wod_murph', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_murph_pullup', 'wod_murph', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_murph_pushup', 'wod_murph', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_murph_squat', 'wod_murph', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Daniel: Pull-ups, Run, Thrusters
('wm_daniel_pullup', 'wod_daniel', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_daniel_run', 'wod_daniel', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_daniel_thruster', 'wod_daniel', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Josh: Overhead squats, Pull-ups
('wm_josh_ohsquat', 'wod_josh', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_josh_pullup', 'wod_josh', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jason: Squats, Muscle-ups
('wm_jason_squat', 'wod_jason', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jason_muscleup', 'wod_jason', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Badger: Squat cleans, Pull-ups, Run
('wm_badger_clean', 'wod_badger', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_badger_pullup', 'wod_badger', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_badger_run', 'wod_badger', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Joshie: Dumbbell snatches, L pull-ups  
('wm_joshie_dbsnatch', 'wod_joshie', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_joshie_pullup', 'wod_joshie', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nate: Muscle-ups, Handstand push-ups, Kettlebell swings
('wm_nate_muscleup', 'wod_nate', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nate_hspu', 'wod_nate', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nate_kbswing', 'wod_nate', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Randy: Power snatches
('wm_randy_powersnatch', 'wod_randy', 'mov_powersnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tommy V: Thrusters, Rope climbs
('wm_tommy_v_thruster', 'wod_tommy_v', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_tommy_v_ropeclimb', 'wod_tommy_v', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Griff: Run
('wm_griff_run', 'wod_griff', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ryan: Muscle-ups, Burpees
('wm_ryan_muscleup', 'wod_ryan', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ryan_burpee', 'wod_ryan', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Erin: Dumbbell cleans, Pull-ups (using clean for dumbbell cleans)
('wm_erin_clean', 'wod_erin', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_erin_pullup', 'wod_erin', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Mr. Joshua: Run, Sit-ups, Deadlifts
('wm_mr_joshua_run', 'wod_mr_joshua', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mr_joshua_situp', 'wod_mr_joshua', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mr_joshua_deadlift', 'wod_mr_joshua', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- DT: Deadlifts, Hang power cleans, Push jerks
('wm_dt_deadlift', 'wod_dt', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_dt_powerclean', 'wod_dt', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_dt_pushjerk', 'wod_dt', 'mov_pushjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Danny: Box jumps, Push press, Pull-ups
('wm_danny_boxjump', 'wod_danny', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_danny_pushpress', 'wod_danny', 'mov_pushpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_danny_pullup', 'wod_danny', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hansen: Kettlebell swings, Burpees, Sit-ups
('wm_hansen_kbswing', 'wod_hansen', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hansen_burpee', 'wod_hansen', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hansen_situp', 'wod_hansen', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tyler: Muscle-ups, Sumo deadlift high pulls
('wm_tyler_muscleup', 'wod_tyler', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_tyler_sdhp', 'wod_tyler', 'mov_sdhp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Lumberjack 20: Deadlifts, Run, KB swings, Overhead squats, Burpees, CTB pull-ups, Box jumps, DB cleans
('wm_lumberjack_20_deadlift', 'wod_lumberjack_20', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_run', 'wod_lumberjack_20', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_kbswing', 'wod_lumberjack_20', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_ohsquat', 'wod_lumberjack_20', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_burpee', 'wod_lumberjack_20', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_ctbpullup', 'wod_lumberjack_20', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_boxjump', 'wod_lumberjack_20', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lumberjack_20_clean', 'wod_lumberjack_20', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Stephen: Sit-ups, Back extensions, Knees-to-elbows, Deadlift
('wm_stephen_situp', 'wod_stephen', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_stephen_toestobar', 'wod_stephen', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_stephen_deadlift', 'wod_stephen', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Garrett: Squats, Ring handstand push-ups, L pull-ups
('wm_garrett_squat', 'wod_garrett', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_garrett_hspu', 'wod_garrett', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_garrett_pullup', 'wod_garrett', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- War Frank: Muscle-ups, Squats, Sit-ups
('wm_war_frank_muscleup', 'wod_war_frank', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_war_frank_squat', 'wod_war_frank', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_war_frank_situp', 'wod_war_frank', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- McGhee: Deadlifts, Push-ups, Box jumps
('wm_mcghee_deadlift', 'wod_mcghee', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mcghee_pushup', 'wod_mcghee', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mcghee_boxjump', 'wod_mcghee', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Paul: Double-unders, Knees-to-elbows (using toes to bar)
('wm_paul_du', 'wod_paul', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_paul_toestobar', 'wod_paul', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jerry: Run, Row
('wm_jerry_run', 'wod_jerry', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jerry_row', 'wod_jerry', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nutts: Handstand push-ups, Deadlifts, Box jumps, Pull-ups, Wall ball, Double-unders, Run
('wm_nutts_hspu', 'wod_nutts', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_deadlift', 'wod_nutts', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_boxjump', 'wod_nutts', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_pullup', 'wod_nutts', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_wallball', 'wod_nutts', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_du', 'wod_nutts', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nutts_run', 'wod_nutts', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Arnie: Turkish get-ups, Kettlebell swings, Overhead squats (using KB for TGU)
('wm_arnie_kbswing', 'wod_arnie', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_arnie_ohsquat', 'wod_arnie', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- The Seven: Handstand push-ups, Thrusters, Knees-to-elbows, Deadlifts, Burpees, KB swings, Pull-ups
('wm_the_seven_hspu', 'wod_the_seven', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_thruster', 'wod_the_seven', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_toestobar', 'wod_the_seven', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_deadlift', 'wod_the_seven', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_burpee', 'wod_the_seven', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_kbswing', 'wod_the_seven', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_the_seven_pullup', 'wod_the_seven', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- RJ: Run, Rope climbs, Push-ups
('wm_rj_run', 'wod_rj', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rj_ropeclimb', 'wod_rj', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rj_pushup', 'wod_rj', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Luce: Run, Muscle-ups, Squats
('wm_luce_run', 'wod_luce', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_luce_muscleup', 'wod_luce', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_luce_squat', 'wod_luce', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Johnson: Deadlifts, Muscle-ups, Squat cleans
('wm_johnson_deadlift', 'wod_johnson', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_johnson_muscleup', 'wod_johnson', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_johnson_clean', 'wod_johnson', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Roy: Deadlifts, Box jumps, Pull-ups
('wm_roy_deadlift', 'wod_roy', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_roy_boxjump', 'wod_roy', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_roy_pullup', 'wod_roy', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Adambrown: Deadlifts, Box jumps, Wall ball, Bench press, Cleans
('wm_adambrown_deadlift', 'wod_adambrown', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_adambrown_boxjump', 'wod_adambrown', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_adambrown_wallball', 'wod_adambrown', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_adambrown_bench', 'wod_adambrown', 'mov_benchpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_adambrown_clean', 'wod_adambrown', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Coe: Thrusters, Ring push-ups
('wm_coe_thruster', 'wod_coe', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_coe_pushup', 'wod_coe', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- New Hero workouts movements
-- Severin: Strict pull-ups, Hand-release push-ups, Run
('wm_severin_pullup', 'wod_severin', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_severin_pushup', 'wod_severin', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_severin_run', 'wod_severin', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Helton: Run, Dumbbell squat cleans, Burpees (using clean for dumbbell cleans)
('wm_helton_run', 'wod_helton', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_helton_clean', 'wod_helton', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_helton_burpee', 'wod_helton', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jack: Push press, Kettlebell swings, Box jumps
('wm_jack_pushpress', 'wod_jack', 'mov_pushpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jack_kbswing', 'wod_jack', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jack_boxjump', 'wod_jack', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Forrest: L pull-ups, Toes-to-bars, Burpees, Run
('wm_forrest_pullup', 'wod_forrest', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_forrest_toestobar', 'wod_forrest', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_forrest_burpee', 'wod_forrest', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_forrest_run', 'wod_forrest', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bulger: Run, Chest-to-bar pull-ups, Front squats, Handstand push-ups
('wm_bulger_run', 'wod_bulger', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bulger_ctbpullup', 'wod_bulger', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bulger_frontsquat', 'wod_bulger', 'mov_frontsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bulger_hspu', 'wod_bulger', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Brenton: Bear crawl, Broad jumps, Burpees (no specific movements for bear crawl/broad jump, using burpee)
('wm_brenton_burpee', 'wod_brenton', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Blake: Overhead walking lunge, Box jumps, Wall ball, Handstand push-ups
('wm_blake_boxjump', 'wod_blake', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_blake_wallball', 'wod_blake', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_blake_hspu', 'wod_blake', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Second batch Hero workouts movements
-- Collin: Sandbag carry, Push press, Box jumps, Sumo deadlift high pulls
('wm_collin_pushpress', 'wod_collin', 'mov_pushpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_collin_boxjump', 'wod_collin', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_collin_sdhp', 'wod_collin', 'mov_sdhp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Thompson: Rope climb, Back squats, Farmers carry (using deadlift for farmers carry)
('wm_thompson_ropeclimb', 'wod_thompson', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_thompson_backsquat', 'wod_thompson', 'mov_backsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_thompson_deadlift', 'wod_thompson', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Whitten: Kettlebell swings, Box jumps, Run, Burpees, Wall ball
('wm_whitten_kbswing', 'wod_whitten', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_whitten_boxjump', 'wod_whitten', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_whitten_run', 'wod_whitten', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_whitten_burpee', 'wod_whitten', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_whitten_wallball', 'wod_whitten', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bull: Double-unders, Overhead squats, Pull-ups, Run
('wm_bull_du', 'wod_bull', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bull_ohsquat', 'wod_bull', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bull_pullup', 'wod_bull', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bull_run', 'wod_bull', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Rankel: Deadlifts, Burpee pull-ups, Kettlebell swings, Run
('wm_rankel_deadlift', 'wod_rankel', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rankel_pullup', 'wod_rankel', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rankel_burpee', 'wod_rankel', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rankel_kbswing', 'wod_rankel', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rankel_run', 'wod_rankel', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Holbrook: Thrusters, Pull-ups, Sprint (using run for sprint)
('wm_holbrook_thruster', 'wod_holbrook', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_holbrook_pullup', 'wod_holbrook', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_holbrook_run', 'wod_holbrook', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ledesma: Handstand push-ups, Toes-to-rings (using toes to bar), Medicine ball cleans (using clean)
('wm_ledesma_hspu', 'wod_ledesma', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ledesma_toestobar', 'wod_ledesma', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ledesma_clean', 'wod_ledesma', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wittman: Kettlebell swings, Power cleans, Box jumps
('wm_wittman_kbswing', 'wod_wittman', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wittman_powerclean', 'wod_wittman', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wittman_boxjump', 'wod_wittman', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- McCluskey: Muscle-ups, Burpee pull-ups, Pull-ups, Run
('wm_mccluskey_muscleup', 'wod_mccluskey', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mccluskey_pullup', 'wod_mccluskey', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mccluskey_burpee', 'wod_mccluskey', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mccluskey_run', 'wod_mccluskey', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Third batch Hero workouts movements
-- Weaver: L pull-ups, Push-ups, Chest-to-bar pull-ups
('wm_weaver_pullup', 'wod_weaver', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_weaver_pushup', 'wod_weaver', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_weaver_ctbpullup', 'wod_weaver', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Abbate: Run, Clean and jerks
('wm_abbate_run', 'wod_abbate', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_abbate_cleanjerk', 'wod_abbate', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hammer: Power cleans, Front squats, Jerks, Pull-ups
('wm_hammer_powerclean', 'wod_hammer', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hammer_frontsquat', 'wod_hammer', 'mov_frontsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hammer_jerk', 'wod_hammer', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hammer_pullup', 'wod_hammer', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Moore: Rope climb, Run, Handstand push-ups
('wm_moore_ropeclimb', 'wod_moore', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_moore_run', 'wod_moore', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_moore_hspu', 'wod_moore', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wilmot: Squats, Ring dips
('wm_wilmot_squat', 'wod_wilmot', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wilmot_ringdip', 'wod_wilmot', 'mov_ringdip', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Moon: Dumbbell snatches, Rope climb
('wm_moon_dbsnatch', 'wod_moon', 'mov_dbsnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_moon_ropeclimb', 'wod_moon', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Small: Row, Burpees, Box jumps, Run
('wm_small_row', 'wod_small', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_small_burpee', 'wod_small', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_small_boxjump', 'wod_small', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_small_run', 'wod_small', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Morrison: Wall ball, Box jumps, Kettlebell swings
('wm_morrison_wallball', 'wod_morrison', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_morrison_boxjump', 'wod_morrison', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_morrison_kbswing', 'wod_morrison', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Manion: Run, Back squats
('wm_manion_run', 'wod_manion', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_manion_backsquat', 'wod_manion', 'mov_backsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gator: Front squats, Ring push-ups (using regular push-ups)
('wm_gator_frontsquat', 'wod_gator', 'mov_frontsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_gator_pushup', 'wod_gator', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Fourth batch Hero workouts movements
-- Bradley: Sprint, Pull-ups, Burpees
('wm_bradley_run', 'wod_bradley', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bradley_pullup', 'wod_bradley', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bradley_burpee', 'wod_bradley', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Meadows: Muscle-ups, Ring movements (using muscle-up, HSPU, row, pushup)
('wm_meadows_muscleup', 'wod_meadows', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_meadows_hspu', 'wod_meadows', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_meadows_row', 'wod_meadows', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_meadows_pushup', 'wod_meadows', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Santiago: DB squat cleans, Pull-ups, Power cleans, HSPU
('wm_santiago_clean', 'wod_santiago', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santiago_pullup', 'wod_santiago', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santiago_powerclean', 'wod_santiago', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santiago_hspu', 'wod_santiago', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Carse: Squat cleans, Double-unders, Deadlifts, Box jumps
('wm_carse_clean', 'wod_carse', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_carse_du', 'wod_carse', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_carse_deadlift', 'wod_carse', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_carse_boxjump', 'wod_carse', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Bradshaw: HSPU, Deadlifts, Pull-ups, Double-unders
('wm_bradshaw_hspu', 'wod_bradshaw', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bradshaw_deadlift', 'wod_bradshaw', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bradshaw_pullup', 'wod_bradshaw', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_bradshaw_du', 'wod_bradshaw', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- White: Rope climbs, Toes-to-bars, Overhead lunges, Run
('wm_white_ropeclimb', 'wod_white', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_white_toestobar', 'wod_white', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_white_run', 'wod_white', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Santora: Squat cleans, Deadlifts, Burpees, Jerks
('wm_santora_clean', 'wod_santora', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santora_deadlift', 'wod_santora', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santora_burpee', 'wod_santora', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_santora_jerk', 'wod_santora', 'mov_jerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Wood: Run, Burpee box jumps, SDHP, Thrusters
('wm_wood_run', 'wod_wood', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wood_burpee', 'wod_wood', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wood_boxjump', 'wod_wood', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wood_sdhp', 'wod_wood', 'mov_sdhp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_wood_thruster', 'wod_wood', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Sixth batch Hero workout movements
-- Klepto: Box jumps, Burpees, Squat cleans
('wm_klepto_boxjump', 'wod_klepto', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_klepto_burpee', 'wod_klepto', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_klepto_clean', 'wod_klepto', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Del: Burpees, Run, Weighted pull-ups, Handstand push-ups, Chest-to-bar pull-ups
('wm_del_burpee', 'wod_del', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_del_run', 'wod_del', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_del_pullup', 'wod_del', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_del_hspu', 'wod_del', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_del_ctbpullup', 'wod_del', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Pheezy: Front squats, Pull-ups, Deadlifts, Toes-to-bars, Push jerks, Hand-release push-ups
('wm_pheezy_frontsquat', 'wod_pheezy', 'mov_frontsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_pheezy_pullup', 'wod_pheezy', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_pheezy_deadlift', 'wod_pheezy', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_pheezy_toestobar', 'wod_pheezy', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_pheezy_pushjerk', 'wod_pheezy', 'mov_pushjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_pheezy_pushup', 'wod_pheezy', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- J.J.: Squat cleans, Parallette handstand push-ups (using HSPU)
('wm_jj_clean', 'wod_jj', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jj_hspu', 'wod_jj', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jag 28: Run, Kettlebell swings, Strict pull-ups, Kettlebell clean and jerks
('wm_jag_28_run', 'wod_jag_28', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jag_28_kbswing', 'wod_jag_28', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jag_28_pullup', 'wod_jag_28', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jag_28_cleanjerk', 'wod_jag_28', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Brian: Rope climbs, Back squats
('wm_brian_ropeclimb', 'wod_brian', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_brian_backsquat', 'wod_brian', 'mov_backsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nick: Dumbbell hang squat cleans (using clean), Handstand push-ups on dumbbells
('wm_nick_clean', 'wod_nick', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nick_hspu', 'wod_nick', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Strange: Run, Weighted pull-ups, Walking lunges, Kettlebell thrusters
('wm_strange_run', 'wod_strange', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_strange_pullup', 'wod_strange', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_strange_lunge', 'wod_strange', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_strange_thruster', 'wod_strange', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tumilson: Run, Dumbbell burpee deadlifts
('wm_tumilson_run', 'wod_tumilson', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_tumilson_deadlift', 'wod_tumilson', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_tumilson_burpee', 'wod_tumilson', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ship: Squat cleans, Burpee box jumps
('wm_ship_clean', 'wod_ship', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ship_burpee', 'wod_ship', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ship_boxjump', 'wod_ship', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jared: Run, Pull-ups, Push-ups
('wm_jared_run', 'wod_jared', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jared_pullup', 'wod_jared', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jared_pushup', 'wod_jared', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Tully: Swim (no existing movement, using run), Dumbbell squat cleans
('wm_tully_run', 'wod_tully', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_tully_clean', 'wod_tully', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Holleyman: Wall-ball shots, Handstand push-ups, Power clean
('wm_holleyman_wallball', 'wod_holleyman', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_holleyman_hspu', 'wod_holleyman', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_holleyman_powerclean', 'wod_holleyman', 'mov_powerclean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- New Hero workouts movements (Hidalgo, Ricky, Dae Han, Desforges, Rahoi, Zimmerman)
-- Hidalgo: Run, Squat cleans, Box jumps, Overhead walking lunges
('wm_hidalgo_run', 'wod_hidalgo', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hidalgo_clean', 'wod_hidalgo', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hidalgo_boxjump', 'wod_hidalgo', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hidalgo_lunge', 'wod_hidalgo', 'mov_lunge', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Ricky: Pull-ups, Dumbbell deadlifts, Push presses
('wm_ricky_pullup', 'wod_ricky', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ricky_deadlift', 'wod_ricky', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_ricky_pushpress', 'wod_ricky', 'mov_pushpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Dae Han: Run, Rope climbs, Thrusters
('wm_dae_han_run', 'wod_dae_han', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_dae_han_ropeclimb', 'wod_dae_han', 'mov_ropeclimb', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_dae_han_thruster', 'wod_dae_han', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Desforges: Deadlifts, Pull-ups, Clean and jerks, Knees-to-elbows
('wm_desforges_deadlift', 'wod_desforges', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_desforges_pullup', 'wod_desforges', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_desforges_cleanjerk', 'wod_desforges', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_desforges_toestobar', 'wod_desforges', 'mov_toestobar', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Rahoi: Box jumps, Thrusters, Bar-facing burpees
('wm_rahoi_boxjump', 'wod_rahoi', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rahoi_thruster', 'wod_rahoi', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_rahoi_burpee', 'wod_rahoi', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Zimmerman: Chest-to-bar pull-ups, Deadlifts, Handstand push-ups
('wm_zimmerman_ctbpullup', 'wod_zimmerman', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_zimmerman_deadlift', 'wod_zimmerman', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_zimmerman_hspu', 'wod_zimmerman', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Add all workouts to the Heroes programming track
INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES 
('trwk_heroes_jt', 'ptrk_heroes', 'wod_jt', 1, 1, 'Classic Hero WOD - handstand push-ups, ring dips, push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_michael', 'ptrk_heroes', 'wod_michael', 2, 1, 'Running with posterior chain work', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_murph', 'ptrk_heroes', 'wod_murph', 3, 1, 'Memorial Day Hero - the ultimate test', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_daniel', 'ptrk_heroes', 'wod_daniel', 4, 1, 'Mixed modal chipper with thrusters', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_josh', 'ptrk_heroes', 'wod_josh', 5, 1, 'Overhead squats and pull-ups ladder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jason', 'ptrk_heroes', 'wod_jason', 6, 1, 'Squats and muscle-ups ascending ladder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_badger', 'ptrk_heroes', 'wod_badger', 7, 1, 'Squat cleans, pull-ups, and running', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_joshie', 'ptrk_heroes', 'wod_joshie', 8, 2, 'Unilateral dumbbell snatches and L pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_nate', 'ptrk_heroes', 'wod_nate', 9, 2, 'AMRAP with advanced gymnastic movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_randy', 'ptrk_heroes', 'wod_randy', 10, 2, 'Simple but brutal - 75 power snatches', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_tommy_v', 'ptrk_heroes', 'wod_tommy_v', 11, 2, 'Thrusters and rope climbs descending ladder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_griff', 'ptrk_heroes', 'wod_griff', 12, 2, 'Running forward and backward', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_ryan', 'ptrk_heroes', 'wod_ryan', 13, 2, 'Muscle-ups and burpees combination', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_erin', 'ptrk_heroes', 'wod_erin', 14, 2, 'Dumbbell split cleans and pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_mr_joshua', 'ptrk_heroes', 'wod_mr_joshua', 15, 3, 'Running, GHD sit-ups, and heavy deadlifts', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_dt', 'ptrk_heroes', 'wod_dt', 16, 3, 'Classic barbell triplet - deadlifts, cleans, jerks', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_danny', 'ptrk_heroes', 'wod_danny', 17, 3, 'AMRAP with box jumps, push press, pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_hansen', 'ptrk_heroes', 'wod_hansen', 18, 3, 'Kettlebell swings, burpees, GHD sit-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_tyler', 'ptrk_heroes', 'wod_tyler', 19, 3, 'Muscle-ups and sumo deadlift high pulls', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_lumberjack_20', 'ptrk_heroes', 'wod_lumberjack_20', 20, 3, 'Long chipper honoring Fort Hood heroes', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_stephen', 'ptrk_heroes', 'wod_stephen', 21, 3, 'Descending ladder with posterior chain focus', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_garrett', 'ptrk_heroes', 'wod_garrett', 22, 4, 'Advanced gymnastics with ring HSPU and L pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_war_frank', 'ptrk_heroes', 'wod_war_frank', 23, 4, 'High volume muscle-ups with squats and sit-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_mcghee', 'ptrk_heroes', 'wod_mcghee', 24, 4, 'Long AMRAP with heavy deadlifts', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_paul', 'ptrk_heroes', 'wod_paul', 25, 4, 'Double-unders, knees-to-elbows, overhead walk', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jerry', 'ptrk_heroes', 'wod_jerry', 26, 4, 'Pure cardio - run and row combination', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_nutts', 'ptrk_heroes', 'wod_nutts', 27, 4, 'Multi-modal chipper with varied movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_arnie', 'ptrk_heroes', 'wod_arnie', 28, 5, 'Single kettlebell complex workout', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_the_seven', 'ptrk_heroes', 'wod_the_seven', 29, 5, 'Seven movements, seven reps, seven rounds', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_rj', 'ptrk_heroes', 'wod_rj', 30, 5, 'Running, rope climbs, and push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_luce', 'ptrk_heroes', 'wod_luce', 31, 5, 'Weighted vest workout with muscle-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_johnson', 'ptrk_heroes', 'wod_johnson', 32, 5, 'Heavy AMRAP with deadlifts, muscle-ups, cleans', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_roy', 'ptrk_heroes', 'wod_roy', 33, 5, 'Deadlifts, box jumps, and pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_adambrown', 'ptrk_heroes', 'wod_adambrown', 34, 5, 'Heavy chipper with bench press', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_coe', 'ptrk_heroes', 'wod_coe', 35, 6, 'High volume thrusters and ring push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- New Hero workouts in programming track
('trwk_heroes_severin', 'ptrk_heroes', 'wod_severin', 36, 6, 'Strict pull-ups, hand-release push-ups, and 5K run with optional vest', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_helton', 'ptrk_heroes', 'wod_helton', 37, 6, 'Running and dumbbell squat cleans with burpees', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jack', 'ptrk_heroes', 'wod_jack', 38, 6, 'AMRAP with push press, kettlebell swings, and box jumps', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_forrest', 'ptrk_heroes', 'wod_forrest', 39, 6, 'Advanced gymnastics with L pull-ups and toes-to-bars', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_bulger', 'ptrk_heroes', 'wod_bulger', 40, 6, 'High volume rounds with running and gymnastics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_brenton', 'ptrk_heroes', 'wod_brenton', 41, 6, 'Unique movement pattern with bear crawl and broad jumps', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_blake', 'ptrk_heroes', 'wod_blake', 42, 7, 'Overhead lunges, box jumps, wall balls, and handstand push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Second batch Hero workouts in programming track
('trwk_heroes_collin', 'ptrk_heroes', 'wod_collin', 43, 7, 'Sandbag carry with strength and conditioning movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_thompson', 'ptrk_heroes', 'wod_thompson', 44, 7, 'Rope climbs with heavy back squats and farmers carry', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_whitten', 'ptrk_heroes', 'wod_whitten', 45, 7, 'High volume rounds with varied movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_bull', 'ptrk_heroes', 'wod_bull', 46, 7, 'Long chipper with double-unders, squats, and running', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_rankel', 'ptrk_heroes', 'wod_rankel', 47, 8, 'AMRAP with heavy deadlifts and burpee pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_holbrook', 'ptrk_heroes', 'wod_holbrook', 48, 8, 'Interval format with thrusters, pull-ups, and sprints', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_ledesma', 'ptrk_heroes', 'wod_ledesma', 49, 8, 'Advanced gymnastics AMRAP with parallette HSPU', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_wittman', 'ptrk_heroes', 'wod_wittman', 50, 8, 'Barbell and conditioning triplet', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_mccluskey', 'ptrk_heroes', 'wod_mccluskey', 51, 8, 'Advanced gymnastics with muscle-ups and burpee pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Third batch Hero workouts in programming track
('trwk_heroes_weaver', 'ptrk_heroes', 'wod_weaver', 52, 8, 'High volume pull-ups and push-ups combination', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_abbate', 'ptrk_heroes', 'wod_abbate', 53, 8, 'Running and clean and jerks endurance test', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_hammer', 'ptrk_heroes', 'wod_hammer', 54, 9, 'Interval barbell complex with pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_moore', 'ptrk_heroes', 'wod_moore', 55, 9, 'AMRAP with rope climbs, running, and max HSPU', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_wilmot', 'ptrk_heroes', 'wod_wilmot', 56, 9, 'Simple but brutal squats and ring dips', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_moon', 'ptrk_heroes', 'wod_moon', 57, 9, 'Unilateral dumbbell work with rope climbs', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_small', 'ptrk_heroes', 'wod_small', 58, 9, 'Mixed modal chipper with rowing and running', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_morrison', 'ptrk_heroes', 'wod_morrison', 59, 9, 'Descending ladder with wall balls, box jumps, KB swings', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_manion', 'ptrk_heroes', 'wod_manion', 60, 9, 'Running and heavy back squats combination', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_gator', 'ptrk_heroes', 'wod_gator', 61, 9, 'Heavy front squats with ring push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Fourth batch Hero workouts in programming track
('trwk_heroes_bradley', 'ptrk_heroes', 'wod_bradley', 62, 9, 'Sprint intervals with pull-ups and burpees', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_meadows', 'ptrk_heroes', 'wod_meadows', 63, 10, 'Advanced ring skills chipper', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_santiago', 'ptrk_heroes', 'wod_santiago', 64, 10, 'Dumbbell and barbell combination with gymnastics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_carse', 'ptrk_heroes', 'wod_carse', 65, 10, 'Descending ladder with bear crawl starts', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_bradshaw', 'ptrk_heroes', 'wod_bradshaw', 66, 10, 'High volume gymnastics and lifting combination', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_white', 'ptrk_heroes', 'wod_white', 67, 10, 'Rope climbs with overhead lunges and running', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_santora', 'ptrk_heroes', 'wod_santora', 68, 10, 'Interval format with barbell movements and burpees', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_wood', 'ptrk_heroes', 'wod_wood', 69, 10, 'Mixed modal with rest intervals', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Sixth batch Hero workouts in programming track
('trwk_heroes_klepto', 'ptrk_heroes', 'wod_klepto', 70, 10, 'Box jumps, burpees, and squat cleans', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_del', 'ptrk_heroes', 'wod_del', 71, 11, 'Medicine ball runs with varied gymnastics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_pheezy', 'ptrk_heroes', 'wod_pheezy', 72, 11, 'Heavy barbell movements with gymnastics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jj', 'ptrk_heroes', 'wod_jj', 73, 11, 'Ascending/descending ladder with parallette HSPU', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jag_28', 'ptrk_heroes', 'wod_jag_28', 74, 11, 'Running with kettlebell work and strict pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_brian', 'ptrk_heroes', 'wod_brian', 75, 11, 'Rope climbs with heavy back squats', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_nick', 'ptrk_heroes', 'wod_nick', 76, 11, 'High volume dumbbell work', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_strange', 'ptrk_heroes', 'wod_strange', 77, 11, 'Running with weighted gymnastics and kettlebells', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_tumilson', 'ptrk_heroes', 'wod_tumilson', 78, 12, 'Short sprints with dumbbell burpee deadlifts', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_ship', 'ptrk_heroes', 'wod_ship', 79, 12, 'Heavy squat cleans with high box jumps', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_jared', 'ptrk_heroes', 'wod_jared', 80, 12, 'Classic running with gymnastics endurance', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_tully', 'ptrk_heroes', 'wod_tully', 81, 12, 'Swimming with dumbbell squat cleans', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_heroes_holleyman', 'ptrk_heroes', 'wod_holleyman', 82, 12, 'High volume chipper with wall balls and power cleans', strftime('%s', 'now'), strftime('%s', 'now'), 0);
