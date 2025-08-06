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



CRITICAL SECURITY FINDINGS
1. MAJOR PII EXPOSURE - Profiles Table
Severity: HIGH 🚨

Your profiles table has a severe security vulnerability where ALL user email addresses and profile information are publicly visible. The current RLS policy is:

"Users can view all profiles" FOR SELECT USING (true)
This means any authenticated user can access all user emails and personal information from the entire platform - a massive privacy violation and potential GDPR compliance issue.

2. Weak Authentication Configuration
Severity: MEDIUM ⚠️

The Supabase linter identified:

OTP expiry exceeds recommended threshold - Authentication tokens stay valid too long
Leaked password protection is disabled - No protection against compromised passwords

3. Missing Input Validation on Team Invitations
Severity: MEDIUM ⚠️

The team invitation system lacks proper validation:

No email format validation before database insertion
No sanitization of invitation messages
No rate limiting on invitation sending
4. Edge Function Email Security
Severity: LOW-MEDIUM ⚠️

The team invitation edge function constructs HTML emails with user input without proper sanitization, though the risk is limited since it's sent via Supabase's email service.
