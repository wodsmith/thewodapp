// Script to scrape CrossFit Open workouts from 2020-2025
// Run with: node scrape-crossfit-workouts.js

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeWorkouts() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const workouts = {};
  const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
  
  for (const year of years) {
    console.log(`\nScraping year ${year}...`);
    workouts[year] = [];
    
    // Start with workout 1 and continue until we hit a 404 or no workout found
    let workoutNumber = 1;
    let hasMoreWorkouts = true;
    
    while (hasMoreWorkouts && workoutNumber <= 10) { // Safety limit of 10 workouts per year
      try {
        const url = `https://games.crossfit.com/workouts/open/${year}/${workoutNumber}?division=2`;
        console.log(`  Fetching workout ${year}.${workoutNumber}...`);
        
        const response = await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        // Check if page loaded successfully
        if (response && response.status() === 200) {
          // Wait for the workout content to load
          await page.waitForSelector('.exercises', { timeout: 5000 }).catch(() => null);
          
          // Extract workout text
          const workoutData = await page.evaluate(() => {
            const workoutDiv = document.querySelector('.exercises');
            if (workoutDiv) {
              return {
                found: true,
                text: workoutDiv.innerText.trim()
              };
            }
            return { found: false };
          });
          
          if (workoutData.found) {
            workouts[year].push({
              number: `${year.slice(-2)}.${workoutNumber}`,
              text: workoutData.text
            });
            console.log(`    ✓ Found workout ${year.slice(-2)}.${workoutNumber}`);
            workoutNumber++;
          } else {
            console.log(`    No workout content found for ${year}.${workoutNumber}`);
            hasMoreWorkouts = false;
          }
        } else {
          console.log(`    No more workouts for year ${year} (404 or error)`);
          hasMoreWorkouts = false;
        }
      } catch (error) {
        console.log(`    Error fetching workout ${year}.${workoutNumber}: ${error.message}`);
        hasMoreWorkouts = false;
      }
    }
    
    console.log(`  Total workouts found for ${year}: ${workouts[year].length}`);
  }
  
  await browser.close();
  
  // Format the workouts for markdown
  let markdownContent = '';
  
  for (const year of years) {
    markdownContent += `\n## CrossFit Games Open ${year}\n`;
    
    if (workouts[year].length === 0) {
      markdownContent += '\n(No workouts found for this year)\n';
    } else {
      for (const workout of workouts[year]) {
        markdownContent += `\n### Open ${workout.number}\n\n`;
        
        // Format the workout text
        const lines = workout.text.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            markdownContent += `${line}\n`;
          }
        }
        markdownContent += '\n';
      }
    }
  }
  
  // Save to file
  const outputPath = path.join(__dirname, 'crossfit-open-workouts-2020-2025.md');
  await fs.writeFile(outputPath, markdownContent);
  console.log(`\nWorkouts saved to ${outputPath}`);
  
  // Also save as JSON for reference
  const jsonPath = path.join(__dirname, 'crossfit-open-workouts-2020-2025.json');
  await fs.writeFile(jsonPath, JSON.stringify(workouts, null, 2));
  console.log(`JSON data saved to ${jsonPath}`);
  
  return workouts;
}

// Run the scraper
scrapeWorkouts()
  .then(() => {
    console.log('\nScraping completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during scraping:', error);
    process.exit(1);
  });