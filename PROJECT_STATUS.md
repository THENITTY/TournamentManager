# DuelManager - Project Status

## 📍 Current Status
**Phase:** Phase 0 (Analysis & Roadmap)
**Last Update:** Initializing...

## 🛣️ Implementation Roadmap

### Phase 1: Foundation & Authentication
*   **Goal:** Secure the app and establish the "Super Admin" hierarchy.
*   **Why:** Security first. We cannot build leagues on an insecure foundation, and the "Manual Approval" flow is a core constraint.
*   **Steps:**
    1.  [x] Initialize Vite React Project + Tailwind CSS (Dark Mode constants).
    2.  [x] Setup Supabase Client & Database Types.
    3.  [x] DB: Create `profiles` table with RLS Policies.
    4.  [/] UI: Login & Registration Screens (Name + Surname, no Nicknames).
    5.  [x] Logic: "Pending Approval" Role Gate (Prevent access until approved).
    6.  [/] UI: Super Admin Dashboard to Approve/Reject new users.

### Phase 2: Data Backbone (Archetypes & Leagues)
*   **Goal:** Create the static data and grouping structures.
*   **Why:** Decks need Archetypes; Tournaments need Leagues. This builds the "Library".
*   **Steps:**
    1.  [ ] DB: Create `leagues`, `league_members`, `archetypes`.
    2.  [ ] UI: Archetype Library (Admin Only).
    3.  [ ] Logic: Integration with Yu-Gi-Oh! API to fetch/store Archetype images.
    4.  [ ] UI: League Manager (Create/Edit Leagues, List Members).

### Phase 3: The Strict Deck System
*   **Goal:** Implement the "Admin-Controlled" Deck Library.
*   **Why:** This is a strict requirement. Users cannot create decks; they must be pre-registered by Admins.
*   **Steps:**
    1.  [ ] DB: Create `registered_decks`, `deck_components`.
    2.  [ ] UI: Deck Creator (Admin Only) - Select Base Archetypes, auto-flag "Hybrid".
    3.  [ ] UI: Deck Explorer (ReadOnly for Users).

### Phase 4: Tournament Engine - Core Loop
*   **Goal:** Ability to start a tournament, pair players, and record results.
*   **Why:** The core utility of the app.
*   **Steps:**
    1.  [ ] DB: Create `tournaments`, `tournament_participants`, `matches`.
    2.  [ ] Logic: Swiss Pairing Algorithm (Round 1 Random, Round 2+ Score-Based).
    3.  [ ] UI: Tournament Control Center (Start Round, Repair).
    4.  [ ] UI: Match Reporting (Mobile-optimized result input).
    5.  [ ] Logic: Scoring System (Win/Bye calculations).

### Phase 5: Advanced Logic & completion
*   **Goal:** Tie-breakers, Top Cut, and Cycle Closure.
*   **Why:** A tournament isn't finished without a winner and data recording.
*   **Steps:**
    1.  [ ] Logic: Tie-Breakers (OMW%, Head-to-Head).
    2.  [ ] UI: Standings & Leaderboard.
    3.  [ ] UI: Top Cut Bracket generation.
    4.  [ ] Logic: Post-Tournament Deck Assignment (Assign deck to participant AFTER event).

### Phase 6: UX Polish & PWA Hardening
*   **Goal:** Mobile experience & Offline safety.
*   **Why:** Reliability in a tournament setting is non-negotiable.
*   **Steps:**
    1.  [ ] UI: Server-Side Timer (Sync).
    2.  [ ] Logic: Offline Detection & Blocking Overlay.
    3.  [ ] Config: PWA Manifest & Icons.
    4.  [ ] Final UI Polish (Animations, Transitions).

## 🗂️ Directory Structure
*(To be populated in Phase 1)*

## 💾 Database Schema
*(To be populated in Phase 1)*
