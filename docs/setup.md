# Setup — the parts that need a human

Three accounts. None of them can be created on someone else's behalf, so
these are yours to do. Everything else is already wired to receive them.

Total time: about twenty minutes.

---

## 1. Vercel — hosting

1. Go to **vercel.com** and sign up with **GitHub**. Authorise it.
2. On the dashboard press **Add New → Project**.
3. Find **outbreak-zombie-shooter** and press **Import**.
4. **This is the step that matters.** Under *Configure Project*:
   - **Root Directory** → press **Edit** → choose the **`web`** folder.
   - Expand it and make sure **"Include source files outside of the Root
     Directory"** is **ON**. The game lives in the repo root and the build
     reaches out to it; with this off the build fails.
   - Framework Preset should say **Next.js** on its own. Leave the build and
     output commands alone.
5. Press **Deploy** and wait. First build is two or three minutes.
6. Copy the URL it gives you — something like
   `outbreak-zombie-shooter.vercel.app`.

**Send me: that URL.**

Every push to `main` redeploys on its own from here.

---

## 2. Supabase — accounts and database

1. Go to **supabase.com**, sign up, press **New project**.
2. Name it `zombie-attack`. Choose the region closest to you — **Frankfurt**
   or **Mumbai** from the UAE. Set a database password and **save it
   somewhere**; it is not shown again.
3. Wait for it to finish setting up, about two minutes.
4. Left sidebar → **Project Settings** (the cog) → **API**.
5. You need two values from that page:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public** key — a long string starting `eyJ...`

**Send me: both of those.**

### One thing to be careful about

On that same page there is a **`service_role`** key. **Do not send it to me
and do not put it anywhere near the browser.** It ignores every security rule
in the database. It goes in Vercel's environment variables directly, by you,
and nowhere else. I will tell you when it is needed — not yet.

The anon key is different: it is *meant* to be public, and it is safe only
because the database denies everything by default. That protection is written
before any account exists.

---

## 3. An email address for support

The contact form needs somewhere to send to and something to send with.

1. Decide where support mail should land. Your own address is fine to start.
2. Go to **resend.com**, sign up, and copy the **API key** it gives you.
   The free tier sends 3,000 a month, which is far more than this will need.

**Send me: the address mail should go to.** Put the Resend key straight into
Vercel yourself (see below) rather than pasting it here.

---

## 4. Putting the keys into Vercel

Once the project exists:

1. Vercel → your project → **Settings** → **Environment Variables**.
2. Add these, ticking **Production**, **Preview** and **Development** for each:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
   | `SUPPORT_EMAIL_TO` | where support mail goes |
   | `RESEND_API_KEY` | the Resend key |

3. **Redeploy** — Deployments → the top one → ⋯ → Redeploy. Environment
   variables are read at build time, so a deploy from before they existed
   will not see them.

---

## 5. Connecting Claude to GitHub and Vercel

This lets me push and deploy without you relaying things by hand.

1. **GitHub token:** github.com → your avatar → Settings → Developer settings
   → Personal access tokens → **Fine-grained tokens** → Generate new.
   - Repository access: **Only select repositories** →
     `outbreak-zombie-shooter`
   - Permissions: **Contents: Read and write**, **Pull requests: Read and
     write**, **Actions: Read**
   - Generate, and copy it.
2. **Vercel token:** vercel.com → Settings → **Tokens** → Create.
3. In your terminal, in the project folder:

   ```
   claude mcp add github --env GITHUB_TOKEN=your_token_here -- npx -y @modelcontextprotocol/server-github
   claude mcp add vercel --env VERCEL_TOKEN=your_token_here -- npx -y @vercel/mcp
   ```

4. Restart Claude Code and run `/mcp` to check both are connected.

Tokens are passwords. They go in that command, not into a chat message.

---

## What to send back

Three things, and none of them are secret:

1. The Vercel URL
2. The Supabase Project URL
3. The Supabase **anon** key
4. The address support mail should go to

Then I can finish accounts, the pages, and the contact form.
