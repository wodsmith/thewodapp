# Product Requirements Document: Gym Scheduler AI

**Version:** 1.5  
**Date:** July 2, 2024

## 1. Introduction

### 1.1. Purpose

This document outlines the product requirements for the Gym Scheduler AI, a web-based application designed to help gym owners automate and optimize their weekly class scheduling process. The application will intelligently assign coaches to classes based on a set of predefined rules, constraints, and preferences.

### 1.2. Problem Statement

Gym owners spend a significant amount of time manually creating and managing weekly class schedules. This process is often complex and prone to errors, especially when dealing with multiple coaches with varying skills, concurrent classes in different locations, and individual coach availability. The current manual process can lead to scheduling conflicts, understaffing or overstaffing of classes, and dissatisfaction among coaches due to inconvenient schedules.

### 1.3. Proposed Solution

The Gym Scheduler AI will be an intelligent, automated scheduling platform. It will allow gym owners to define their gym's layout (locations), create a catalog of class types, and assign specific skills to coaches. The AI engine will then use this information, along with coach availability and preferences, to generate an optimized, conflict-free schedule that respects all constraints, saving the gym owner time and improving overall efficiency.

## 2. Goals and Objectives

### 2.1. Business Goals

- Reduce the time and effort required for gym owners to create weekly schedules.
- Increase coach satisfaction and retention by creating more balanced and preferred schedules.
- Improve operational efficiency by ensuring optimal coach allocation for all classes.
- Minimize scheduling errors and conflicts.

### 2.2. Product Goals

- Provide an intuitive and user-friendly interface for managing classes, locations, and coaches.
- Develop a powerful AI engine that can generate optimal schedules based on a variety of complex constraints.
- Ensure the generated schedules are fair, balanced, and respect coach preferences and qualifications.
- Allow for easy viewing, editing, and sharing of the final schedule.

## 3. User Personas

(No changes to this section)

## 4. Features

### 4.1. Gym Setup & Configuration

- **General Settings:** The gym owner can set the gym's country to enable accurate holiday detection.
- **Manage Locations:** Create and manage a list of distinct locations within the gym where classes can be held (e.g., "Main Floor," "Studio 2," "Lifting Platform").
- **Manage Class Catalog:** Create and manage a catalog of all class types offered by the gym (e.g., "CrossFit," "Sweat," "Olympic Lifting," "Kids Class").
- **Manage Coach Skills:** Create and manage a list of skills or certifications required to teach certain classes (e.g., "CrossFit Level 1," "Yoga Certified," "Kids Class Certified").

### 4.2. Coach Management

- **Coach Profiles:** Create and manage profiles for each coach, including their name, contact information, and assigned skills/certifications.
- **Set Weekly Class Limits:** For each coach, define the maximum number of classes they can be scheduled for in a single week.
- **Set Time Preferences:** For each coach, assign a preference for working in the "Morning" (e.g., 5am-12pm), "Afternoon" (12pm-5pm), or "Night" (5pm-10pm).
- **Blackout Dates/Times:** Input specific dates and times when a coach is unavailable.

### 4.3. Schedule Management

- **Create & Manage Schedule Templates:** Gym owners can create a master weekly schedule template. When building the template, they will place specific class types from the catalog into designated time slots and locations.
- **Set Class Requirements:** For each class placed in the template, the owner can specify the number of coaches required and any mandatory skills needed to teach it.
- **Apply & Modify Weekly Schedules:** Owners can apply the master template to a specific week and then make one-off changes (e.g., canceling a class for a holiday) without altering the master template.

### 4.4. AI Scheduling Engine

- **Automated Schedule Generation:** With a single click, the AI engine will analyze all classes, locations, skills, and coach constraints for the selected week to produce an optimized schedule.
- **Constraint-Based Logic:** The engine will strictly adhere to all defined hard constraints:
  - A coach's weekly class limit.
  - A coach's blackout times.
  - Skill Constraint: A coach must have the required skill for the class they are assigned to.
  - Location Constraint: A location can only have one class scheduled at a time.
- **Preference-Based Optimization:** The engine will treat coach time preferences as a "soft constraint," aiming to maximize the number of classes assigned during a coach's preferred time block.
- **Historical Schedule Weighting:** The engine will analyze past schedules to distribute classes more equitably over time and encourage variety.
- **Holiday Awareness & Prompts:** The engine will be aware of national holidays for the gym's country and will proactively prompt the owner when scheduling a week that contains one.
- **Conflict Resolution & Unstaffed Class Handling:** If the AI cannot fill a class slot due to hard constraints, it will leave the slot empty and notify the owner that the schedule requires manual attention.

### 4.5. Schedule Viewing and Management

- **Weekly Calendar View:** Display the generated schedule in a clear, easy-to-read weekly calendar format, with clear distinctions between different locations.
- **Unscheduled Slot Highlighting:** Any class slot that the AI could not fill will be clearly and visually highlighted on the calendar to draw the owner's immediate attention.
- **Manual Overrides:** Allow the gym owner to make manual adjustments to the generated schedule. The system will flag any conflicts created by manual changes.
- **Export & Share:** Export the final schedule to PDF or CSV formats.

## 5. User Stories

- As a gym owner, I want to define all the different locations in my gym where classes can happen, so I can schedule multiple classes at the same time.
- As a gym owner, I want to create a catalog of all the different types of classes I offer, so I can easily place them on my schedule.
- As a gym owner, I want to define which skills are needed to teach certain classes, and assign those skills to my coaches, to ensure proper qualifications.
- As a gym owner, I want to create a standard weekly class template so I don't have to re-enter the same schedule every week.
- As a gym owner, I want to be notified about upcoming holidays when I'm scheduling.
- As a gym owner, I want to have the system clearly show me which classes couldn't be filled automatically, so I know exactly where I need to find a coach.
- As a gym owner, I want to click a button and have the AI generate the entire week's schedule, respecting all my constraints like coach skills and locations.
- As a coach, I want to only be scheduled for classes I am certified to teach.

