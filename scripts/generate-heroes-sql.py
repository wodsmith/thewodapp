#!/usr/bin/env python3
"""
Script to generate CrossFit Heroes SQL seed script from markdown file.
Processes unfinished workouts (without ✅ checkmarks) and generates SQL.
"""

import re
import sys
from pathlib import Path

# Constants
CROSSFIT_TEAM_ID = 'team_cokkpu1klwo0ulfhl1iwzpvn'

def slugify(text):
    """Convert text to SQL-safe slug."""
    return re.sub(r'[^\w]', '_', text.lower()).strip('_')

def determine_scheme(description):
    """Determine workout scheme from description."""
    desc_lower = description.lower()
    if 'complete as many rounds and reps as possible' in desc_lower or 'amrap' in desc_lower:
        return 'rounds-reps'
    elif 'complete as many rounds as possible' in desc_lower:
        return 'rounds-reps'
    elif 'for time' in desc_lower:
        return 'time'
    elif 'emom' in desc_lower or 'every minute on the minute' in desc_lower:
        return 'emom'
    elif 'tabata' in desc_lower:
        return 'emom'
    else:
        return 'time'  # default

def extract_movements(description):
    """Extract movement names from workout description."""
    movements = []
    movement_map = {
        'run': 'mov_run', 'sprint': 'mov_run', 'jog': 'mov_run',
        'pull-ups': 'mov_pullup', 'pullups': 'mov_pullup', 'pull up': 'mov_pullup',
        'chest-to-bar pull-ups': 'mov_ctbpullup', 'ctb pull-ups': 'mov_ctbpullup',
        'push-ups': 'mov_pushup', 'pushups': 'mov_pushup', 'push up': 'mov_pushup',
        'handstand push-ups': 'mov_hspu', 'handstand push up': 'mov_hspu', 'hspu': 'mov_hspu',
        'air squats': 'mov_airsquat', 'squats': 'mov_airsquat', 'squat': 'mov_airsquat',
        'front squats': 'mov_frontsquat', 'front squat': 'mov_frontsquat',
        'back squats': 'mov_backsquat', 'back squat': 'mov_backsquat',
        'overhead squats': 'mov_ohsquat', 'overhead squat': 'mov_ohsquat',
        'deadlifts': 'mov_deadlift', 'deadlift': 'mov_deadlift',
        'sumo deadlift high pulls': 'mov_sdhp', 'sdhp': 'mov_sdhp',
        'clean and jerks': 'mov_cleanjerk', 'clean and jerk': 'mov_cleanjerk',
        'cleans': 'mov_clean', 'clean': 'mov_clean', 'power cleans': 'mov_powerclean',
        'jerks': 'mov_jerk', 'jerk': 'mov_jerk', 'push jerks': 'mov_pushjerk',
        'snatches': 'mov_snatch', 'snatch': 'mov_snatch', 'power snatches': 'mov_powersnatch',
        'thrusters': 'mov_thruster', 'thruster': 'mov_thruster',
        'press': 'mov_press', 'shoulder press': 'mov_press',
        'push press': 'mov_pushpress', 'push presses': 'mov_pushpress',
        'box jumps': 'mov_boxjump', 'box jump': 'mov_boxjump',
        'burpees': 'mov_burpee', 'burpee': 'mov_burpee',
        'wall-ball shots': 'mov_wallball', 'wall ball': 'mov_wallball', 'wall balls': 'mov_wallball',
        'kettlebell swings': 'mov_kbswing', 'kb swings': 'mov_kbswing', 'kettlebell swing': 'mov_kbswing',
        'double-unders': 'mov_doubleunder', 'double unders': 'mov_doubleunder', 'dus': 'mov_doubleunder',
        'single-unders': 'mov_singleunder', 'single unders': 'mov_singleunder',
        'toes-to-bars': 'mov_toestobar', 'toes to bar': 'mov_toestobar', 'ttb': 'mov_toestobar',
        'knees-to-elbows': 'mov_knees_to_elbows', 'knees to elbows': 'mov_knees_to_elbows',
        'sit-ups': 'mov_situp', 'sit up': 'mov_situp', 'situps': 'mov_situp',
        'muscle-ups': 'mov_muscleup', 'muscle up': 'mov_muscleup',
        'ring muscle-ups': 'mov_ringmuscleup', 'ring muscle up': 'mov_ringmuscleup',
        'rope climbs': 'mov_ropeclimb', 'rope climb': 'mov_ropeclimb',
        'ring dips': 'mov_ringdip', 'ring dip': 'mov_ringdip',
        'bench press': 'mov_benchpress', 'bench presses': 'mov_benchpress',
        'lunges': 'mov_lunge', 'lunge': 'mov_lunge', 'walking lunges': 'mov_lunge',
        'pistols': 'mov_pistol', 'pistol': 'mov_pistol',
        'row': 'mov_row', 'rowing': 'mov_row',
        'bike': 'mov_bike', 'biking': 'mov_bike', 'assault bike': 'mov_assaultbike',
        'ski erg': 'mov_skierg', 'skiing': 'mov_skierg'
    }
    
    desc_lower = description.lower()
    found_movements = set()
    
    for movement_text, movement_id in movement_map.items():
        if movement_text in desc_lower:
            found_movements.add(movement_id)
    
    return list(found_movements)

def parse_workout(workout_text):
    """Parse a single workout from markdown text."""
    lines = workout_text.strip().split('\n')
    
    # Extract workout name from header
    header_match = re.match(r'### \*\*(.+?)\*\*', lines[0])
    if not header_match:
        return None
    
    name = header_match.group(1).strip()
    
    # Skip workouts that already have checkmarks
    if '✅' in name:
        return None
    
    # Find the description (everything until the honor statement)
    description_lines = []
    collecting_description = False
    
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        if line.startswith('For time:') or line.startswith('Complete as many') or line.startswith('AMRAP') or any(x in line for x in ['rounds for time', 'minutes of:', 'rounds of:', 'EMOM']):
            collecting_description = True
            description_lines.append(line)
        elif collecting_description and (line.startswith('♀') or line.startswith('♂')):
            description_lines.append('')
            description_lines.append(line)
        elif collecting_description and line.startswith('!['):
            break  # Hit the image, stop collecting
        elif collecting_description:
            description_lines.append(line)
    
    # Find honor statement (everything after image until "First posted")
    honor_lines = []
    collecting_honor = False
    
    for line in lines:
        line = line.strip()
        if line.startswith('!['):
            collecting_honor = True
            continue
        elif collecting_honor and line.startswith('_First posted'):
            break
        elif collecting_honor and line:
            honor_lines.append(line)
    
    description = '\n'.join(description_lines).strip()
    honor = '\n'.join(honor_lines).strip()
    full_description = f"{description}\n\n{honor}" if honor else description
    
    # Escape single quotes in description
    full_description = full_description.replace("'", "''")
    
    workout = {
        'name': name,
        'slug': slugify(name),
        'description': full_description,
        'scheme': determine_scheme(full_description),
        'movements': extract_movements(full_description)
    }
    
    return workout

def generate_sql(workouts, start_day=140, start_week=20):
    """Generate SQL for the given workouts."""
    sql_parts = []
    
    # Header
    sql_parts.append("""-- CrossFit Heroes Workouts Seed Script - Generated
-- Uses existing CrossFit user, team, and Heroes programming track

-- Create additional Heroes workouts
INSERT INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES""")
    
    # Workout definitions
    workout_inserts = []
    for workout in workouts:
        workout_inserts.append(f"""-- {workout['name']}
('wod_{workout['slug']}', '{workout['name']}', '{workout['description']}', '{workout['scheme']}', 'public', '{CROSSFIT_TEAM_ID}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)""")
    
    sql_parts.append(',\n\n'.join(workout_inserts) + ';')
    
    # Workout tags
    sql_parts.append("\n-- Tag all workouts as Hero benchmarks")
    sql_parts.append("INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES")
    
    tag_inserts = []
    for workout in workouts:
        slug = workout['slug']
        tag_inserts.extend([
            f"('wtag_{slug}_hero', 'wod_{slug}', 'tag_hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)",
            f"('wtag_{slug}_benchmark', 'wod_{slug}', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)"
        ])
    
    sql_parts.append(',\n'.join(tag_inserts) + ';')
    
    # Workout movements
    sql_parts.append("\n-- Create workout movements relationships")
    sql_parts.append("INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES")
    
    movement_inserts = []
    for workout in workouts:
        slug = workout['slug']
        if workout['movements']:
            for i, movement in enumerate(workout['movements']):
                movement_name = movement.replace('mov_', '')
                movement_inserts.append(f"('wm_{slug}_{movement_name}', 'wod_{slug}', '{movement}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)")
    
    if movement_inserts:
        sql_parts.append(',\n'.join(movement_inserts) + ';')
    else:
        sql_parts.append("-- No movements to insert;")
    
    # Programming track
    sql_parts.append("\n-- Add workouts to the Heroes programming track")
    sql_parts.append("INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES")
    
    track_inserts = []
    day = start_day
    week = start_week
    
    for workout in workouts:
        slug = workout['slug']
        description = workout['description'][:50] + '...' if len(workout['description']) > 50 else workout['description']
        description = description.replace('\n', ' ').replace("'", "''")
        
        track_inserts.append(f"('trwk_heroes_{slug}', 'ptrk_heroes', 'wod_{slug}', {day}, {week}, '{description}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)")
        
        day += 1
        if day > 7 * week:
            week += 1
    
    sql_parts.append(',\n'.join(track_inserts) + ';')
    
    return '\n'.join(sql_parts)

def main():
    """Main function."""
    if len(sys.argv) != 2:
        print("Usage: python generate-heroes-sql.py <path-to-heros.md>")
        sys.exit(1)
    
    md_file = Path(sys.argv[1])
    if not md_file.exists():
        print(f"Error: File {md_file} not found")
        sys.exit(1)
    
    # Read markdown file
    content = md_file.read_text()
    
    # Split into individual workouts
    workout_sections = re.split(r'\n### \*\*', content)
    workouts = []
    
    for i, section in enumerate(workout_sections):
        if i == 0:
            continue  # Skip the first split which is before the first workout
        
        # Add back the header marker
        section = '### **' + section
        workout = parse_workout(section)
        if workout:  # Only add workouts without checkmarks
            workouts.append(workout)
    
    if not workouts:
        print("No unfinished workouts found!")
        return
    
    print(f"Found {len(workouts)} unfinished workouts:")
    for workout in workouts:
        print(f"  - {workout['name']}")
    
    # Generate SQL
    sql = generate_sql(workouts)
    
    # Write to output file
    output_file = Path('seed-crossfit-heroes-generated.sql')
    output_file.write_text(sql)
    print(f"\nSQL written to {output_file}")
    print("\nTo add checkmarks to processed workouts, run:")
    for workout in workouts:
        print(f"  sed -i '' 's/### \\*\\*{workout['name']}\\*\\*/### **✅ {workout['name']}**/' {md_file}")

if __name__ == '__main__':
    main()