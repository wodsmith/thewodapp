---
sidebar_position: 1
---

# Create Your First Competition

In this tutorial, we will create a complete competition on WODsmith. By the end, you will have a live competition page with divisions configured, events added, and registration open to athletes.

## What We'll Accomplish

1. Create a competition
2. Configure divisions
3. Add workout events
4. Set up pricing
5. Publish and share

This process takes about 15-20 minutes. Let's begin!

## Step 1: Create the Competition

First, we'll create the competition and set the basic details.

1. Click **COMPETE** in the top navigation
2. Click **ORGANIZE** to access your organizer dashboard
3. Click **Create Competition**

![Organizer Dashboard](/img/tutorials/organizers/step1-organizer-dashboard.png)

4. Fill in the competition details:
   - **Organizing Team**: Select your team from the dropdown
   - **Competition Name**: Enter a name (e.g., "Spring Throwdown 2025")
   - **Slug**: A URL-friendly identifier will be auto-generated, or customize it
   - **Start Date** and **End Date**: Set your competition dates
   - **Registration Opens/Closes** (Optional): Set when athletes can register
   - **Description** (Optional): Add details about your competition

![Create Competition Form](/img/tutorials/organizers/step1-create-competition-form.png)

5. Click **Create Competition**

**You should see** your competition dashboard. This is your control center for managing the event.

![Competition Dashboard](/img/tutorials/organizers/step1-competition-dashboard.png)

## Step 2: Configure Divisions

Now we'll set up the divisions athletes can register for.

1. Click **Divisions** in the left sidebar
2. Click **Add Division**
3. Enter "RX" as the division name
4. Optionally expand the division to add a description

![Divisions Page](/img/tutorials/organizers/step2-divisions.png)

**Notice** the division appears in your list with a count of registered athletes.

### Add More Divisions

Let's add the remaining standard divisions:

1. Click **Add Division** again
2. Create divisions for your competition:
   - RX
   - Scaled
   - Masters 40+
   - Teens 14-17

You can drag divisions to reorder them. The first division will appear first in registration dropdowns.

<!-- FEATURE NOT FOUND: Participant caps per division are not currently available in the UI -->

## Step 3: Add Competition Events

Now we'll add the workouts athletes will compete in.

1. Click **Events** in the left sidebar
2. Click **Create Event** (or **Add Existing** to use a workout from your library)

![Events List](/img/tutorials/organizers/step3-events-list.png)

3. In the Create Event dialog:
   - Enter the **Event Name** (e.g., "Event 1 - Fran")
   - Select the **Scheme** (For Time, AMRAP, etc.)
   - Choose the **Score Type**
   - Optionally add **Movements** from the available list

![Create Event Dialog](/img/tutorials/organizers/step3-create-event-dialog.png)

4. Click **Create Event**

**You should see** the event appear in your events list.

### Add More Events

Repeat the process to add additional events. You can:

- Drag events to reorder them
- Set event status (Draft, Published)
- Add scoring multipliers for specific events

<!-- FEATURE NOT FOUND: Time cap configuration and detailed movement reps/weights are configured in the event detail page, not the creation dialog -->

## Step 4: Set Up Pricing

Configure registration fees for your competition.

1. Click **Pricing** in the left sidebar under "Business"
2. If you haven't connected Stripe, you'll see a prompt to set up payouts

![Pricing Page](/img/tutorials/organizers/step4-pricing.png)

3. Click **Set Up Payouts** to connect your Stripe account
4. Once connected, you can set registration fees per division

**Note**: Free registrations ($0) work without a Stripe connection.

## Step 5: Publish Your Competition

We're ready to make the competition visible to athletes!

1. Click **Edit** in the competition header (or navigate to the Edit page)
2. Scroll down to find the **Status** dropdown
3. Change Status from "Draft" to "Published"
4. Set **Visibility** to "Public" if you want the competition listed on the public events page

![Edit Settings](/img/tutorials/organizers/step5-edit-settings.png)

5. Click **Save Changes**

**You should see** the status badges update in the header.

## Step 6: Share Your Competition

Your competition is now live! Let's get the registration link.

1. Click **View Public Page** in the competition header
2. On the public page, click **Share** to copy the link

![Public Competition Page](/img/tutorials/organizers/step6-public-page.png)

**Notice** the URL format: `yourdomain.com/compete/your-competition-slug`

This is the link you'll share with athletes to register.

## You've Done It!

Congratulations! You have successfully created a competition with:

- Divisions configured for different skill levels
- Workout events ready for competition day
- Registration open for athletes

## What's Next

As registrations come in:

- [Manage registrations](/how-to/organizers/manage-registrations) - View and manage athlete signups
- [Schedule heats](/how-to/organizers/schedule-heats) - Organize athlete heat times
- [Run event day](/how-to/organizers/event-day) - Scoring, leaderboards, results

---

_Need to modify your competition? Click **Edit** from your competition dashboard to update any settings._
