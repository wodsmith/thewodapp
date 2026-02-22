import type { Client } from "@planetscale/database"
import { batchInsert, dateToUnix, now } from "../helpers"

// Password hash for "password123"
const PASSWORD_HASH =
	"8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983"

// Password hash for "crossfit"
const CROSSFIT_PASSWORD_HASH =
	"eb1405f82c02e3e74723c82b24e16948:2c25e5090d2496f0a06fcd77f4a41e733abec33e0b0913637060e6619f3963f6"

const EMAIL_VERIFIED = "2025-06-17 18:28:51"

export async function seed(client: Client): Promise<void> {
	console.log("Seeding users...")

	const ts = now()

	function user(
		id: string,
		firstName: string,
		lastName: string,
		email: string,
		role: string,
		credits: number,
		gender: string | null,
		dob: string | null,
		hash = PASSWORD_HASH,
	) {
		return {
			id,
			first_name: firstName,
			last_name: lastName,
			email,
			email_verified: EMAIL_VERIFIED,
			password_hash: hash,
			role,
			current_credits: credits,
			gender,
			date_of_birth: dob ? dateToUnix(dob) : null,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		}
	}

	await batchInsert(client, "users", [
		// Demo users
		user("usr_demo1admin", "Admin", "User", "admin@example.com", "admin", 100, "male", "1985-03-15"),
		user("usr_demo2coach", "Coach", "Smith", "coach@example.com", "user", 50, "male", "1990-07-22"),
		user("usr_demo3member", "John", "Doe", "john@example.com", "user", 25, "male", "1992-11-08"),
		user("usr_demo4member", "Jane", "Smith", "jane@example.com", "user", 25, "female", "1995-05-30"),
		// Athletes
		user("usr_athlete_mike", "Mike", "Johnson", "mike@athlete.com", "user", 0, "male", "1988-09-12"),
		user("usr_athlete_sarah", "Sarah", "Williams", "sarah@athlete.com", "user", 0, "female", "1993-02-28"),
		user("usr_athlete_chris", "Chris", "Brown", "chris@athlete.com", "user", 0, "male", "1991-06-17"),
		user("usr_athlete_emma", "Emma", "Davis", "emma@athlete.com", "user", 0, "female", "1997-12-05"),
		// RX Division Athletes
		user("usr_athlete_alex", "Alex", "Turner", "alex.turner@athlete.com", "user", 0, "male", "1994-03-15"),
		user("usr_athlete_ryan", "Ryan", "Mitchell", "ryan.mitchell@athlete.com", "user", 0, "male", "1992-07-22"),
		user("usr_athlete_marcus", "Marcus", "Reed", "marcus.reed@athlete.com", "user", 0, "male", "1990-11-08"),
		user("usr_athlete_tyler", "Tyler", "Brooks", "tyler.brooks@athlete.com", "user", 0, "male", "1995-01-30"),
		user("usr_athlete_jordan", "Jordan", "Hayes", "jordan.hayes@athlete.com", "user", 0, "male", "1993-09-12"),
		user("usr_athlete_nathan", "Nathan", "Cole", "nathan.cole@athlete.com", "user", 0, "male", "1991-05-25"),
		user("usr_athlete_derek", "Derek", "Foster", "derek.foster@athlete.com", "user", 0, "male", "1989-12-03"),
		user("usr_athlete_brandon", "Brandon", "West", "brandon.west@athlete.com", "user", 0, "male", "1996-08-17"),
		// Scaled Division Athletes
		user("usr_athlete_megan", "Megan", "Parker", "megan.parker@athlete.com", "user", 0, "female", "1996-04-20"),
		user("usr_athlete_ashley", "Ashley", "Morgan", "ashley.morgan@athlete.com", "user", 0, "female", "1998-02-14"),
		user("usr_athlete_brittany", "Brittany", "Taylor", "brittany.taylor@athlete.com", "user", 0, "female", "1994-10-05"),
		user("usr_athlete_stephanie", "Stephanie", "Clark", "stephanie.clark@athlete.com", "user", 0, "female", "1993-06-28"),
		user("usr_athlete_lauren", "Lauren", "Adams", "lauren.adams@athlete.com", "user", 0, "female", "1997-01-11"),
		user("usr_athlete_nicole", "Nicole", "Roberts", "nicole.roberts@athlete.com", "user", 0, "female", "1995-08-19"),
		user("usr_athlete_amanda", "Amanda", "Nelson", "amanda.nelson@athlete.com", "user", 0, "female", "1992-12-07"),
		user("usr_athlete_kaitlyn", "Kaitlyn", "Hill", "kaitlyn.hill@athlete.com", "user", 0, "female", "1999-03-24"),
		// Volunteers
		user("usr_volunteer_dave", "Dave", "Martinez", "dave.martinez@volunteer.com", "user", 0, "male", "1985-04-12"),
		user("usr_volunteer_lisa", "Lisa", "Chen", "lisa.chen@volunteer.com", "user", 0, "female", "1990-08-25"),
		user("usr_volunteer_tom", "Tom", "Wilson", "tom.wilson@volunteer.com", "user", 0, "male", "1988-01-17"),
		user("usr_volunteer_rachel", "Rachel", "Kim", "rachel.kim@volunteer.com", "user", 0, "female", "1992-11-30"),
		user("usr_volunteer_james", "James", "Rodriguez", "james.rodriguez@volunteer.com", "user", 0, "male", "1987-06-08"),
		user("usr_volunteer_emily", "Emily", "Thompson", "emily.thompson@volunteer.com", "user", 0, "female", "1994-02-14"),
		user("usr_volunteer_kevin", "Kevin", "Patel", "kevin.patel@volunteer.com", "user", 0, "male", "1991-09-22"),
		user("usr_volunteer_maria", "Maria", "Garcia", "maria.garcia@volunteer.com", "user", 0, "female", "1989-12-03"),
		user("usr_volunteer_brian", "Brian", "Lee", "brian.lee@volunteer.com", "user", 0, "male", "1993-07-19"),
		user("usr_volunteer_sandra", "Sandra", "Nguyen", "sandra.nguyen@volunteer.com", "user", 0, "female", "1995-05-11"),
		// CrossFit admin user
		user("usr_crossfit001", "CrossFit", "Admin", "crossfit@gmail.com", "admin", 1000, null, null, CROSSFIT_PASSWORD_HASH),
	])
}
