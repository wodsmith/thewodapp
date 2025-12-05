/**
 * Migration script to move athlete sponsors from JSON (athleteProfile.sponsors)
 * to the new sponsors table.
 *
 * Since this needs to run in Cloudflare D1, we use a SQL-based approach.
 *
 * Run the migration check first:
 *   wrangler d1 execute wodsmith-db --local --command "SELECT id, athleteProfile FROM user WHERE athleteProfile LIKE '%sponsors%' LIMIT 10;"
 *
 * Manual migration process:
 * 1. Export users with sponsors: wrangler d1 execute wodsmith-db --local --command "SELECT id, athleteProfile FROM user WHERE athleteProfile LIKE '%\"sponsors\":%';"
 * 2. For each user, parse the JSON and run INSERT statements
 * 3. Update the athleteProfile to remove sponsors array
 *
 * NOTE: This script provides a Node.js helper to generate the SQL statements
 * that you can then run via wrangler d1 execute.
 */

interface OldSponsor {
	name: string
	logoUrl?: string
	website?: string
}

interface AthleteProfile {
	sponsors?: OldSponsor[]
	[key: string]: unknown
}

function generateMigrationSQL(users: Array<{ id: string; athleteProfile: string }>) {
	const statements: string[] = []
	
	for (const user of users) {
		if (!user.athleteProfile) continue
		
		let profile: AthleteProfile
		try {
			profile = JSON.parse(user.athleteProfile) as AthleteProfile
		} catch {
			console.error(`Could not parse profile for user ${user.id}`)
			continue
		}
		
		if (!profile.sponsors || profile.sponsors.length === 0) continue
		
		// Generate INSERT statements for each sponsor
		profile.sponsors.forEach((sponsor, index) => {
			if (!sponsor.name) return
			
			const id = `spnsr_migrate_${user.id.slice(-8)}_${index}`
			const now = Math.floor(Date.now() / 1000)
			
			const name = sponsor.name.replace(/'/g, "''")
			const logoUrl = sponsor.logoUrl ? sponsor.logoUrl.replace(/'/g, "''") : null
			const website = sponsor.website ? sponsor.website.replace(/'/g, "''") : null
			
			statements.push(
				`INSERT INTO sponsors (id, userId, competitionId, groupId, name, logoUrl, website, displayOrder, createdAt, updatedAt) ` +
				`VALUES ('${id}', '${user.id}', NULL, NULL, '${name}', ${logoUrl ? `'${logoUrl}'` : 'NULL'}, ${website ? `'${website}'` : 'NULL'}, ${index}, ${now}, ${now});`
			)
		})
		
		// Generate UPDATE to remove sponsors from profile
		const { sponsors: _, ...profileWithoutSponsors } = profile
		const newProfile = JSON.stringify(profileWithoutSponsors).replace(/'/g, "''")
		
		statements.push(
			`UPDATE user SET athleteProfile = '${newProfile}', updatedAt = ${Math.floor(Date.now() / 1000)} WHERE id = '${user.id}';`
		)
	}
	
	return statements
}

// Example usage - paste the JSON output from wrangler d1 execute here
const exampleUsers = [
	// { id: "usr_xxx", athleteProfile: '{"sponsors":[{"name":"Nike"}]}' }
]

if (exampleUsers.length > 0) {
	const sql = generateMigrationSQL(exampleUsers)
	console.log("Generated SQL statements:\n")
	sql.forEach(s => console.log(s))
} else {
	console.log(`
Athlete Sponsors Migration Script
==================================

This script helps migrate sponsors from the athleteProfile JSON field
to the new sponsors table.

Steps:
1. First, check which users have sponsors:
   
   wrangler d1 execute wodsmith-db --local --command "SELECT id, athleteProfile FROM user WHERE athleteProfile LIKE '%\\"sponsors\\":%';"

2. Copy the results and paste them into the exampleUsers array in this script

3. Run this script again to generate the SQL statements:
   
   pnpm tsx scripts/migrate-athlete-sponsors.ts

4. Execute the generated SQL:
   
   wrangler d1 execute wodsmith-db --local --file=<generated-sql-file>

For production, use --remote instead of --local.
`)
}
