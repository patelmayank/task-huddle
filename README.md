# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/dad8092f-cd4d-45c8-ac1e-cdd6c5f2baaf

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/dad8092f-cd4d-45c8-ac1e-cdd6c5f2baaf) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/dad8092f-cd4d-45c8-ac1e-cdd6c5f2baaf) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

# 🛠 Bug Fixes Documentation -- TaskHuddle (v0.1.0)

## Overview

**TaskHuddle** -- Collaborative task board with real-time updates
(Next.js, TypeScript, Supabase, Tailwind, shadcn-ui).\
This document lists critical bugs found during the "Lovable" test build
and how they were fixed.

------------------------------------------------------------------------

### 1) Unauthorized Task Visibility via Public Projects

**File**: `supabase/policies.sql`\
**Severity**: Critical\
**Status**: ✅ Fixed\
**Problem**\
Tasks from private projects could be queried if the parent project's
`is_private=false`, even when the user was not a member.\
**Root Cause**\
A policy allowed `select` on `projects` when `not is_private`, but
`tasks` policy didn't re-check membership---creating an indirect read
path.\
**Fix**

``` sql
-- enforce membership on tasks, regardless of project privacy
drop policy if exists "Tasks: select if project member" on public.tasks;
create policy "Tasks: select if project member"
on public.tasks for select
using ( public.is_member(project_id) );
```

**Impact**\
- ✅ Private boards remain private\
- ✅ Least-privilege enforced consistently

------------------------------------------------------------------------

### 2) Realtime Memory Leaks on Route Changes

**File**: `features/board/KanbanBoard.tsx`\
**Severity**: High\
**Status**: ✅ Fixed\
**Problem**\
Multiple subscriptions persisted after navigating between projects,
causing duplicate events and heavy CPU usage.\
**Root Cause**\
Subscription cleanup not called in `useEffect` unmount.\
**Fix**

``` tsx
useEffect(() => {
  const unsubscribe = subscribeTasks(projectId, refetch);
  return () => unsubscribe(); // ensures channel is removed
}, [projectId]);
```

**Impact**\
- ✅ Single source of truth for events\
- ✅ Improved performance and battery life

------------------------------------------------------------------------

### 3) Drag & Drop Order Collisions

**File**: `features/board/useReorder.ts`\
**Severity**: High\
**Status**: ✅ Fixed\
**Problem**\
Rapid reorders produced duplicate `order_index` leading to flicker and
incorrect ordering after refresh.\
**Root Cause**\
Indices were compacted with `0..n` and updated in parallel; concurrent
updates clashed.\
**Fix** - Switched to **gap-based indexing** (e.g., 10, 20, 30) and
transactional server update.

``` ts
await supabase.rpc('reindex_task', { p_task_id: id, p_new_status: toStatus, p_target_index: toIndex });
```

**Impact**\
- ✅ Stable ordering under concurrency\
- ✅ No post-refresh jumps

------------------------------------------------------------------------

### 4) Role Escalation via Client-Side Check

**File**: `features/projects/MemberManager.tsx`,
`supabase/policies.sql`\
**Severity**: Critical\
**Status**: ✅ Fixed\
**Problem**\
Changing roles from the client relied on UI visibility checks; a crafted
request could promote a member to admin.\
**Root Cause**\
Missing server-side authorization on `project_members` updates.\
**Fix**

``` sql
alter table public.project_members enable row level security;
-- allow only owner/admin to insert/delete; no direct UPDATE of role
revoke update(role) on public.project_members from anon, authenticated;
-- update via RPC that checks owner/admin
```

**Impact**\
- ✅ No privilege escalation\
- ✅ Auditable role changes

------------------------------------------------------------------------

### 5) Invitation Email Case Sensitivity Caused "Ghost Members"

**File**: `features/projects/invite.ts`\
**Severity**: Medium\
**Status**: ✅ Fixed\
**Problem**\
Invites sent to `User@domain.com` vs `user@domain.com` created duplicate
pending rows and failed auto-join on sign-up.\
**Root Cause**\
Emails were stored as provided, not normalized.\
**Fix**

``` ts
const normalized = email.trim().toLowerCase();
```

**Impact**\
- ✅ Consistent membership linking\
- ✅ Fewer support issues

------------------------------------------------------------------------

### 6) Duplicate Task Creation on Slow Network Retries

**File**: `features/tasks/useCreateTask.ts` + Edge Route (optional)\
**Severity**: High\
**Status**: ✅ Fixed\
**Problem**\
Refreshing/retrying during creation produced duplicate tasks.\
**Root Cause**\
No idempotency key.\
**Fix**

``` ts
// client
await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'x-request-id': crypto.randomUUID() },
  body: JSON.stringify(payload),
});
```

``` sql
-- server/RPC stores request_id in a unique column on tasks_meta
create unique index on public.tasks_meta(request_id);
```

**Impact**\
- ✅ No duplicates\
- ✅ Cleaner analytics

------------------------------------------------------------------------

### 7) Timezone Drift on Due Dates

**File**: `utils/date.ts`\
**Severity**: Medium\
**Status**: ✅ Fixed\
**Problem**\
Due dates saved at midnight UTC rendered as previous day for users west
of UTC.\
**Root Cause**\
Used `new Date(due).toISOString()` without preserving date-only
semantics.\
**Fix** - Store `due_date` as `date` (already in schema) and avoid
converting to `timestamptz`.\
- Render with `format(zonedTimeToUtc(dueDate, tz), 'PPP')` only when
needed. **Impact**\
- ✅ Consistent calendar dates globally

------------------------------------------------------------------------

### 8) RLS Blocked Admin Deletes

**File**: `supabase/policies.sql`\
**Severity**: Medium\
**Status**: ✅ Fixed\
**Problem**\
Admins could not delete tasks created by members.\
**Root Cause**\
`delete` policy checked only `owner_id`.\
**Fix**

``` sql
drop policy if exists "Tasks: delete by admin or owner" on public.tasks;
create policy "Tasks: delete by admin or owner"
on public.tasks for delete
using (
  exists (
    select 1 from public.project_members
    where project_id = tasks.project_id
      and user_id = auth.uid()
      and role = 'admin'
  ) or exists (
    select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = auth.uid()
  )
);
```

**Impact**\
- ✅ Admin workflows restored

------------------------------------------------------------------------

### 9) N+1 Queries on Board Load

**File**: `features/board/useTasks.ts`\
**Severity**: Medium\
**Status**: ✅ Fixed\
**Problem**\
Fetching tasks then fetching assigned user for each task resulted in
many network calls.\
**Fix**

``` ts
const { data } = await supabase
  .from('tasks')
  .select(`
    id, title, status, priority, order_index, labels, due_date, created_at,
    assignee:assigned_to ( id, email )
  `)
  .eq('project_id', projectId)
  .order('order_index', { ascending: true });
```

**Impact**\
- ✅ Faster board load, fewer round trips

------------------------------------------------------------------------

### 10) Accessible Label Contrast & Focus Rings

**File**: `components/TaskCard.tsx`, `globals.css`\
**Severity**: Low\
**Status**: ✅ Fixed\
**Problem**\
Badge colors failed WCAG AA on dark mode; keyboard focus was unclear.\
**Fix** - Use shadcn `Badge` variants with CSS variables.\
- Added `focus-visible:outline` classes.\
**Impact**\
- ✅ Better accessibility scores

------------------------------------------------------------------------

### 11) Mobile Kanban Overflow

**File**: `features/board/KanbanBoard.tsx`\
**Severity**: Low\
**Status**: ✅ Fixed\
**Problem**\
Columns overflowed viewport and clipped cards.\
**Fix**

``` tsx
<div className="flex gap-4 overflow-x-auto overscroll-x-contain snap-x snap-mandatory">
  {/* columns... */}
</div>
```

**Impact**\
- ✅ Smooth horizontal scrolling on small screens

------------------------------------------------------------------------

### 12) Missing `updated_at` Trigger

**File**: `supabase/triggers.sql`\
**Severity**: Low\
**Status**: ✅ Fixed\
**Problem**\
`updated_at` not refreshed on edits; sorting by "recently updated" was
wrong.\
**Fix**

``` sql
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
for each row execute function touch_updated_at();
```

**Impact**\
- ✅ Accurate "recently updated" lists

---

## CRITICAL (HIGH PRIORITY)

### 13) Task Access Broken
**File**: `supabase/policies.sql`  
**Severity**: Critical  
**Status**: ❌ Identified  
**Problem**  
Project members cannot access tasks they're assigned to. Only project owners can view/manage tasks.  
**Root Cause**  
RLS policies are scoped only to `owner_id`, ignoring valid `project_members`.  
**Fix Proposal**
```sql
create policy "Tasks: members can view assigned tasks"
on public.tasks for select
using (
  public.is_member(project_id)
  or assigned_to = auth.uid()
);
```
**Impact**  
- 🚫 Blocked core functionality for members  
- ✅ Fix restores expected collaboration

---

### 14) Team Member Access Issue
**File**: `supabase/policies.sql`  
**Severity**: Critical  
**Status**: ❌ Identified  
**Problem**  
Project members cannot view other team members in projects they belong to.  
**Root Cause**  
`project_members` table lacks a proper `select` policy for members.  
**Fix Proposal**
```sql
create policy "Members: visible to other members"
on public.project_members for select
using ( public.is_member(project_id) );
```
**Impact**  
- 🚫 Collaboration blocked  
- ✅ Fix allows member lists to show correctly

---

### 15) Email Harvesting Vulnerability
**File**: `supabase/policies.sql`  
**Severity**: Critical  
**Status**: ❌ Identified  
**Problem**  
Team invitations table exposes raw email addresses to any authenticated user.  
**Root Cause**  
No RLS or overly broad read permissions on invitations table.  
**Fix Proposal**
```sql
alter table public.invitations enable row level security;

create policy "Invitations visible only to project admins/owners"
on public.invitations for select
using (
  exists (
    select 1 from public.project_members
    where project_id = invitations.project_id
    and user_id = auth.uid()
    and role = 'admin'
  ) or exists (
    select 1 from public.projects p
    where p.id = invitations.project_id
      and p.owner_id = auth.uid()
  )
);
```
**Impact**  
- 🚫 Risk of email scraping and spam  
- ✅ Fix ensures invitations visible only to trusted roles

---

## MEDIUM PRIORITY

### 16) Password Security Weakness
**File**: `supabase/auth/settings`  
**Severity**: Medium  
**Status**: ❌ Identified  
**Problem**  
Leaked password protection (HIBP integration) is disabled in Supabase auth settings.  
**Fix Proposal**  
Enable `HIBP` check in Supabase dashboard → Auth → Settings.

---

### 17) OTP Expiry Misconfiguration
**File**: `supabase/auth/settings`  
**Severity**: Medium  
**Status**: ❌ Identified  
**Problem**  
OTP tokens have longer expiry (30m) than recommended 5–10m security threshold.  
**Fix Proposal**  
Set OTP token expiry = 10m in Supabase dashboard → Auth → Settings.

---
