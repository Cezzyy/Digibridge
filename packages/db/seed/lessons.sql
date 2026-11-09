-- DigiBridge starter lessons: the 9-lesson set, 3 areas × 3 lesson tiers (LES-01).
--
-- Each area has a Foundations, an Intermediate and an Advanced lesson, all published, so the
-- results page links every recommendation to a lesson (RES-02) and /lessons shows the full
-- library. Bodies are Markdown (## headings, lists, tables, > tips), rendered on the lesson page
-- with markdown-it and cleaned with DOMPurify. The page shows the title and summary itself, so
-- a body starts at its first ## section. No images or videos yet: uploads come in Stage 3.
--
-- Run it once in the Supabase SQL editor (paste and Run), after dev-questions.sql, which adds
-- the 3 areas. It is safe to run again: a lesson whose slug is taken, or whose area and tier
-- already have a published lesson, is left out, so edits here won't reach rows already loaded.
-- Every ID starts with de000000-, like the practice items. To make room for the team's own
-- lessons (Build plan, Stage 4), unpublish these first:
--
--   update lessons set is_published = false where id::text like 'de000000-%';
--
-- Bodies are dollar-quoted ($md$ ... $md$), so no SQL escaping is needed anywhere in them.

begin;

do $$
begin
  if (select count(*) from competency_areas
      where code in ('info_literacy', 'communication', 'safety')) < 3 then
    raise exception 'The 3 areas are missing. Run packages/db/seed/dev-questions.sql first.';
  end if;
end
$$;

create temp table dev_lessons (
  id uuid primary key,
  area_code text not null,
  tier lesson_tier not null,
  slug text not null,
  title text not null,
  summary text not null,
  resources jsonb not null,
  body_md text not null
) on commit drop;

insert into dev_lessons values

-- ---------- Information and data literacy ----------

('de000000-0000-4000-a000-000000000101', 'info_literacy', 'foundations',
 'search-smart',
 'Search smart and spot what you can trust',
 'Type searches that find what you need on the first try, and check a website before you believe it.',
 '[
   {"label": "Google Search Help: Refine your searches", "url": "https://support.google.com/websearch/answer/2466433"},
   {"label": "Be Internet Awesome by Google", "url": "https://beinternetawesome.withgoogle.com/en_us"}
 ]',
 $md$## What you’ll learn

- How to type a search that finds what you need on the first try
- How to read a page of results, ads included
- Five quick checks before you trust a website
- How to name and save files so you can find them again

## 1. Pick the right keywords

A search engine matches words, not sentences. Start with the most important words, then add the details that matter: **who**, **what**, **where** and **when**.

| Instead of | Try |
| --- | --- |
| help me please money for school | CHED scholarship requirements 2026 |
| why is my phone slow | Android phone slow after update fix |
| research about climate | climate change effects on Philippine farmers |

A few tricks make your searches sharper:

- **Quotation marks** find an exact phrase: `"Data Privacy Act"`
- **A minus sign** leaves a word out: `jaguar -car` finds the animal, not the car
- **`site:`** searches one website or one kind of site: `scholarship site:gov.ph`
- **`filetype:`** finds a kind of file: `enrollment form filetype:pdf`

> **Tip:** If your first search doesn’t work, change one or two words instead of starting over. Use the words an expert would use: “symptoms” instead of “feeling sick”.

## 2. Read the results page

- **Ads come first.** Results marked *Sponsored* or *Ad* were paid for. They can be useful, but they aren’t the best match, only the one that paid.
- **Look at the web address under each title** before you click. It tells you whose site you’re about to open.
- **Read past the first result.** The answer you need is often the third or fourth one, or on the second page.
- **Check the date** shown with the result. Last year’s requirements may not be this year’s.

## 3. Check a website before you trust it

Ask these five questions about any page you plan to believe, use or share:

1. **Who made it?** Look for an About page, an author’s name, or a school, agency or company behind it. No name at all is a warning sign.
2. **What is the address?** Sites ending in `.gov.ph` belong to the Philippine government, and `.edu.ph` to schools. Watch out for lookalikes such as `ched-scholarship.com.ph-apply.online`.
3. **When was it written or updated?** Old pages can be wrong now, especially about prices, rules or deadlines.
4. **Why does it exist?** To inform you, to sell you something, to change your mind, or to get your clicks?
5. **Can you find the same facts somewhere else?** Check at least one other trusted source.

> **Remember:** A nice design, lots of ads or thousands of shares don’t make a page true.

## 4. Save what you find so you can find it again

- **Name files by what they are and when:** `Class schedule 1st sem 2026.pdf`, not `IMG_2034.pdf`.
- **Keep folders by subject or term:** `School 2026` › `Math`, `School 2026` › `English`.
- **Bookmark useful pages,** or paste the link and its title into your notes.
- **Keep a copy online,** in Google Drive or another cloud folder, so a lost or broken phone doesn’t take your files with it.

## Try it

1. Search for your school’s enrollment requirements, once in plain words and once with `site:`. Which search was better?
2. Pick one result and answer the five questions from part 3 about it.
3. Rename three files on your phone or laptop so their names say what they are.

## Key points

- Specific keywords beat long sentences.
- Before you trust a page, check who made it, its address, its date, its purpose and whether others agree.
- Good file names and folders save you time later.
$md$),

('de000000-0000-4000-a000-000000000102', 'info_literacy', 'intermediate',
 'check-before-you-share',
 'Check a claim before you share it',
 'Read sideways, trace photos to where they came from, and use fact-checkers to tell real news from fake.',
 '[
   {"label": "Google Search Help: Search with an image", "url": "https://support.google.com/websearch/answer/1325808"},
   {"label": "VERA Files", "url": "https://verafiles.org"},
   {"label": "Creative Commons licenses explained", "url": "https://creativecommons.org/share-your-work/cclicenses/"}
 ]',
 $md$## What you’ll learn

- Why false posts spread so fast
- Four moves to check any claim in a few minutes
- How to tell when a photo or video isn’t what it says
- How to use what you find in school work without copying

## 1. Why false posts spread

False posts are made to make you **feel something fast**: angry, scared, proud or amused. Strong feelings make people share before they think. A post that makes you want to react right away is the one to slow down on.

Some posts aren’t fully false, but still mislead you:

- **The headline says more than the story.** “Classes cancelled nationwide!” when the article says one city.
- **Old news shared as new.** A real typhoon photo from 2013 posted as today’s flood.
- **Out of context.** A real quote, cut so it means the opposite.
- **Satire taken seriously.** A joke site’s story shared as fact.

## 2. Four moves to check a claim (SIFT)

**S – Stop.** Before you share or react, pause. Ask: do I know this source? Do I know this is true?

**I – Investigate the source.** Don’t judge a site by its own About page. Open a new tab and search for the site or the account’s name. What do *other* people say about it? This is called **reading sideways** (lateral reading), and it’s what professional fact-checkers do first.

**F – Find better coverage.** Search for the claim itself. If something big really happened, several trusted news outlets will report it. If only one page or account has it, be careful.

**T – Trace it to the original.** Screenshots and reposts lose details. Find where the claim, quote or photo first appeared, and check that it says what the post says it does.

> **Tip:** Fact-checking sites like VERA Files may have checked the claim already. Search the claim with the words “fact check”.

## 3. Check photos and videos

- **Do a reverse image search.** In Google, tap the camera icon (Google Lens) and upload the photo or a screenshot. You’ll see where and when it appeared before.
- **Look for clues in the picture:** signs, weather, clothes, cars. Do they match the place and time the post claims?
- **Be careful with edited and AI-made images.** Look for odd hands, warped text, blurry edges and lighting that doesn’t match. The surest check is still to trace the image to a trusted source.
- **For videos,** take a screenshot of a clear frame and search it the same way.

## 4. Use sources the right way in school work

- **Paraphrase:** explain the idea in your own words, then say where it came from.
- **Quote:** copy only a short part, put it in quotation marks, and name the source.
- **Cite:** list the author, title, site and date, in the format your teacher asks for.
- **Images count too.** Look for images you’re allowed to reuse, such as ones with a Creative Commons license, and credit the creator.

Copying someone’s work and passing it off as yours is **plagiarism**, even if it’s from the internet, and even if “everyone does it”.

## Try it

1. Find a post in your feed that made you feel something strongly. Go through the four moves. Was it true, false or misleading?
2. Reverse-search a viral photo. When and where did it first appear?
3. Write one sentence from an article in your own words, then add its source.

## Key points

- Strong feelings are a signal to slow down.
- Check the source by reading what others say about it, not what it says about itself.
- Trace claims, quotes and photos back to where they started.
- Give credit every time you use someone else’s work.
$md$),

('de000000-0000-4000-a000-000000000103', 'info_literacy', 'advanced',
 'read-data-with-care',
 'Read data, charts and AI answers with care',
 'Spot charts and numbers that mislead, step out of your filter bubble, and check what AI tools tell you.',
 '[
   {"label": "DigComp 2.2: the European digital competence framework", "url": "https://joint-research-centre.ec.europa.eu/digcomp_en"},
   {"label": "Be Internet Awesome by Google", "url": "https://beinternetawesome.withgoogle.com/en_us"}
 ]',
 $md$## What you’ll learn

- Five ways a chart or number can mislead you
- Why “happened together” doesn’t mean “caused”
- How feeds decide what you see, and how to see more
- How to use AI chatbots without being fooled by them
- How to keep your own files and data safe for the long run

## 1. Charts that mislead

A chart can use real numbers and still give you the wrong idea. Look out for these:

| Trick | What to check |
| --- | --- |
| **The side doesn’t start at zero.** 92% and 96% look like “doubled” when the side starts at 90%. | Read the numbers on the side, not just the size of the bars. |
| **A picked time range.** Showing only the weeks prices went up. | Ask what happened before and after. |
| **Counts instead of rates.** “More accidents in Cebu than in a small town” — Cebu has more people. | Compare per person, per 1,000 or as a percentage. |
| **A tiny group.** “8 out of 10 students agree!” — when 10 were asked. | Look for how many were asked, and who. |
| **No source.** A nice graphic with no name behind it. | Find where the numbers came from. |

## 2. Together isn’t the same as caused

Ice cream sales and drownings both go up in summer. Ice cream doesn’t cause drowning: hot weather drives both. When a post says one thing **causes** another, ask:

- Could something else explain both?
- Could it be the other way around?
- Was it tested, or just noticed?

## 3. Your feed is picked for you

Search engines and social media show you posts based on what you clicked, liked and watched before. Over time you see more of what you already agree with and less of everything else. This is called a **filter bubble**, and it can make one side of a story look like the whole story.

To step out of it:

- **Follow sources with different views,** including ones you don’t always agree with.
- **Search the topic directly** instead of waiting for it in your feed.
- **Clear or pause your watch and search history** now and then, or use a private window to compare results.
- **Notice how you feel.** If every post agrees with you, you’re likely in a bubble.

## 4. Use AI chatbots carefully

Tools like ChatGPT, Gemini and Meta AI can explain ideas and help you plan, but they **can be wrong while sounding sure**. They sometimes make up facts, quotes and even sources that don’t exist.

- **Check facts, names, dates and numbers** in a trusted source before you use them.
- **Ask for sources, then open them.** If a link doesn’t work or doesn’t say what the AI claimed, don’t use it.
- **Follow your school’s rules.** Ask your teacher if and how AI may be used, and say when you used it.
- **Don’t paste private information** — yours or anyone else’s — into a chatbot.

> **Tip:** Use AI to understand a topic or get started, then do the checking and the writing yourself. That’s how you actually learn it.

## 5. Keep your data safe for the long run

- **Keep two copies of anything important,** for example on your phone and in Google Drive.
- **Export what matters** from apps you might stop using: photos, notes, school files.
- **Use clear folder names and dates,** so you can find things years later.

## Try it

1. Find a chart in the news or your feed. Check its side, its time range, whether it uses counts or rates, and its source.
2. Ask an AI chatbot a question you already know the answer to. Was it right? Did its sources check out?
3. Follow one news source that you wouldn’t usually read, and compare how it covers a story.

## Key points

- Read a chart’s numbers, range and source, not just its shape.
- Two things happening together doesn’t prove one caused the other.
- Feeds show you more of the same; step out on purpose.
- AI answers are a starting point, never the final word.
$md$),

-- ---------- Communication and collaboration ----------

('de000000-0000-4000-a000-000000000201', 'communication', 'foundations',
 'talk-clearly-online',
 'Talk clearly and kindly online',
 'Choose the right way to reach people, write messages that get answered, and keep good manners in class chats and online classes.',
 '[
   {"label": "Common Sense Education: Digital citizenship", "url": "https://www.commonsense.org/education/digital-citizenship"},
   {"label": "Be Internet Awesome by Google", "url": "https://beinternetawesome.withgoogle.com/en_us"}
 ]',
 $md$## What you’ll learn

- Which tool to use for which message
- How to write a message to a teacher that gets a reply
- Good manners for group chats and online classes
- How to keep your tone from being misread

## 1. Pick the right tool

| You need to… | Use |
| --- | --- |
| Reach someone about something urgent | A call |
| Ask a teacher or office something formal | Email, or your school’s learning site |
| Share an update with your whole class | The class group chat |
| Work on a file together | A shared document or folder |
| Talk about something private | A private message, not the group |

## 2. Write a message that gets answered

When you message a teacher, an office or anyone you don’t know well:

- **Say who you are:** your full name and section.
- **Say what you need in the first line.**
- **Give the details** they need to help you.
- **Be polite and short,** and check your spelling before you send.
- **Use a clear subject** if it’s an email.

Here’s an example:

> **Subject:** Request to submit Activity 3 late – Juan Dela Cruz, BSIT 1-A
>
> Good morning, Ma’am Santos.
>
> I’m Juan Dela Cruz from BSIT 1-A. I wasn’t able to submit Activity 3 yesterday because our internet was down all day. May I submit it today before 5 PM?
>
> Thank you,
> Juan Dela Cruz

## 3. Good manners in group chats

- **Stay on topic.** Keep the class chat for class. Memes go in the barkada chat.
- **Mind the time.** Avoid sending messages late at night unless it’s urgent.
- **Mention people** (@name) only when you need them to see it.
- **Don’t share private things** from the group outside it, like screenshots of someone’s messages, without asking first.
- **Read before you ask.** Your question may have been answered already.

## 4. Good manners in online classes

- **Join on time,** and use your real name so the teacher knows it’s you.
- **Mute your microphone** when you’re not talking.
- **Turn your camera on** when you’re asked to, and check what’s behind you.
- **Use the chat or the raise-hand button** for questions instead of talking over others.

## 5. Your tone can be misread

Text has no voice or face, so short messages can sound cold or angry even when you don’t mean it.

- “ok.” can sound annoyed; “Okay, thanks!” sounds friendly.
- **ALL CAPITALS reads like shouting.**
- Emojis can help show your tone, but keep them light in formal messages.
- If you’re upset, **wait before you reply.** Read your message again as if you were the one receiving it.

> **Tip:** Before you send, ask yourself: would I say this to their face?

## Try it

1. Write a message to a teacher asking to move a deadline. Check it against the list in part 2.
2. Look at your class group chat. Which manners from part 3 does it follow, and which does it need?

## Key points

- Match the tool to the message.
- Say who you are and what you need, politely and clearly.
- Keep group chats on topic and private things private.
- If a message could be misread, rewrite it before you send.
$md$),

('de000000-0000-4000-a000-000000000202', 'communication', 'intermediate',
 'work-together-online',
 'Work together in group chats and shared files',
 'Plan group work online, share files the right way, and know what to do when you see cyberbullying.',
 '[
   {"label": "Google Docs Help", "url": "https://support.google.com/docs"},
   {"label": "Common Sense Education: Digital citizenship", "url": "https://www.commonsense.org/education/digital-citizenship"}
 ]',
 $md$## What you’ll learn

- How to plan a group project so nobody is left out
- How to share and edit files together without losing work
- How to run an online meeting that works on mobile data
- What to do when you see or face cyberbullying

## 1. Plan the project together

Most group projects go wrong at the start, not the end. In your first meeting, agree on:

- **One place for everything:** one group chat and one shared folder.
- **Who does what:** write each person’s task and name next to it.
- **Deadlines before the real deadline,** so there’s time to put the parts together.
- **When and how you’ll meet,** with everyone’s schedule and connection in mind.

## 2. Share files the right way

- **Use one shared document** instead of sending files back and forth. Everyone always sees the latest version.
- **Choose the right access** when you share:
  - *Viewer* can only read.
  - *Commenter* can read and leave comments.
  - *Editor* can change everything.
- **Use comments and suggestions** to propose changes to someone else’s part, instead of deleting their work.
- **Version history** lets you see who changed what and bring back an older version if something goes wrong.
- **Name files clearly:** `Group 3 – Research paper – Final draft`.

> **Tip:** Only share files with the people who need them. A link set to “Anyone with the link” can be opened by anyone it gets forwarded to.

## 3. Meetings that work for everyone

Not everyone has fast internet or unlimited data.

- **Pick a time that works for most,** and share notes with whoever can’t make it.
- **Audio only** uses much less data than video.
- **Write a short summary** after the meeting: what you decided, who does what, and by when.
- **Record decisions in the group chat,** so there’s one place to check.

## 4. Disagree without fighting

- **Talk about the work, not the person:** “This part needs a source” instead of “You’re lazy”.
- **Suggest, don’t command.**
- **Take big disagreements to a call,** where tone is easier to hear than in text.
- **If someone isn’t doing their part,** talk to them privately first. If that doesn’t help, tell your teacher, with facts and dates.

## 5. Cyberbullying: what to do

Cyberbullying is using phones, chats or social media to hurt, shame, scare or leave someone out, again and again. Mean memes, fake accounts, spreading private photos and group chats made to gang up on someone are all cyberbullying.

**If you see it happen to someone:**

- **Don’t join in,** not even with a laughing reaction. Reactions tell the bully people are watching and enjoying it.
- **Speak up kindly** if you feel safe to, or message the person privately to check on them.
- **Report the post** to the app, and tell a teacher or a trusted adult.

**If it happens to you:**

- **Don’t reply** to the bully. Replies often make it worse.
- **Save the proof:** take screenshots with dates and names.
- **Block and report** the account.
- **Tell someone you trust:** a parent, a teacher, a guidance counselor. You don’t have to deal with it alone.

## Try it

1. For your next group project, write a one-message plan: tasks, names and deadlines.
2. Open a shared document and find its version history.
3. Think of what you’d say privately to a classmate who was teased in a group chat.

## Key points

- Agree on one place, clear tasks and early deadlines.
- Share files with the right access, and use comments instead of deleting.
- Plan meetings with everyone’s time and connection in mind.
- Never join in on bullying; support, save proof, report and tell someone.
$md$),

('de000000-0000-4000-a000-000000000203', 'communication', 'advanced',
 'your-digital-footprint',
 'Manage your digital footprint and lead by example',
 'Shape what people find about you online, respect other people’s rights and work, and help your groups handle conflict.',
 '[
   {"label": "Creative Commons licenses explained", "url": "https://creativecommons.org/share-your-work/cclicenses/"},
   {"label": "National Privacy Commission", "url": "https://privacy.gov.ph"},
   {"label": "Common Sense Education: Digital citizenship", "url": "https://www.commonsense.org/education/digital-citizenship"}
 ]',
 $md$## What you’ll learn

- What your digital footprint is, and who looks at it
- How to check and clean up what’s online about you
- How to respect other people’s privacy and work
- How to help a group chat stay safe and fair

## 1. Your digital footprint

Your **digital footprint** is everything online that’s about you.

- **What you leave on purpose:** posts, comments, photos, likes, shares, reviews.
- **What you leave without noticing:** your location, the sites you visit, what you search and watch, and what others post about you.

Schools, scholarship committees and employers often search applicants’ names. What they find can help you or hurt you, years after you posted it.

> **Remember:** “Private” isn’t really private. Anyone in a private group or chat can take a screenshot and share it.

## 2. Check and clean up your footprint

1. **Search your own name** in Google and on social media, logged out or in a private window.
2. **Look through your old posts and photos.** Archive, hide or delete what you wouldn’t want a teacher or employer to see.
3. **Check your privacy settings** on each app: who can see your posts, your friends list, your birthday and your contact details.
4. **Review tags.** Turn on tag review so you approve photos before they appear on your profile.
5. **Build a good footprint, too:** share your projects, achievements and things you care about.

## 3. Respect other people online

- **Ask before you post photos of others,** especially photos of children or of people in embarrassing moments.
- **Don’t share private messages or screenshots** without permission.
- **Never post someone’s personal details** — address, phone number, school, family — to expose or shame them. This is called *doxxing*, and it can put people in real danger. Under the Data Privacy Act, sharing someone’s personal information without their consent can also be against the law.
- **Don’t join pile-ons.** When thousands of people attack one person over a post, even if they did something wrong, it can do serious harm. Report the post instead.

## 4. Respect people’s work

- **Credit creators** when you share their photos, art, music or writing.
- **Look for reusable work:** Creative Commons licenses tell you how you may use something, for example only with credit, or not for selling.
- **Don’t repost paid content,** like movies, e-books or course files, for free.

## 5. Lead your group chats

If you run a group chat or a class page, you can set the tone:

- **Write a few simple rules** at the start: stay on topic, no insults, no sharing private things.
- **Step in early** when an argument starts. Move it to private messages or a call.
- **Remove or mute people** who keep breaking the rules, after a warning.
- **Protect members’ privacy:** don’t add people without asking, and remove those who left the class.

## Try it

1. Search your own name in a private window. Is there anything you’d want to clean up?
2. Check who can see your posts, birthday and friends list on one app, and fix one setting.
3. Find an image with a Creative Commons license and write the credit line for it.

## Key points

- Everything you post adds to a footprint that lasts.
- Check your name, your old posts and your privacy settings every few months.
- Ask before posting others, credit creators, and never expose someone’s personal details.
- Good group rules and early action keep a chat safe for everyone.
$md$),

-- ---------- Online safety ----------

('de000000-0000-4000-a000-000000000301', 'safety', 'foundations',
 'lock-down-your-accounts',
 'Lock down your accounts',
 'Make strong passwords, turn on 2-step verification and keep your phone updated, so your accounts stay yours.',
 '[
   {"label": "Google Security Checkup", "url": "https://myaccount.google.com/security-checkup"},
   {"label": "Google Account Help: Turn on 2-Step Verification", "url": "https://support.google.com/accounts/answer/185839"},
   {"label": "Have I Been Pwned: check if your email was in a data breach", "url": "https://haveibeenpwned.com"}
 ]',
 $md$## What you’ll learn

- How to make a password that’s strong and easy to remember
- Why each account needs its own password
- What 2-step verification is, and how to turn it on
- How to stay safe on shared computers
- Why updates and screen locks matter

## 1. Make strong passwords

Most accounts are taken over because the password was easy to guess or was used somewhere else that got leaked.

**Weak passwords** use things people can find out about you: your name, birthday, pet, school or `123456`. A password like `juan2007` can be guessed in seconds.

**Strong passwords are long.** Length matters more than odd symbols. The easiest way to make one is a **passphrase**: four or more random words joined together.

| Weak | Strong |
| --- | --- |
| `juan2007` | `mango-jeepney-rainy-guitar` |
| `password1` | `BlueCarabaoReads7Books` |
| `aclc2026` | `kape at pandesal sa umaga!` |

## 2. One password per account

If you use the same password everywhere and one site leaks it, attackers will try it on your email, Facebook and GCash too.

- **Use a different password for every important account,** starting with your email, because it can reset all the others.
- **Let a password manager remember them for you.** The one built into your browser or phone (like Google Password Manager) is a good start.
- **Never share your password,** not even with friends or your partner.

## 3. Turn on 2-step verification

**2-step verification** (2SV) adds a second check on top of your password, usually a code sent to your phone or a tap on a prompt. Even if someone gets your password, they can’t get in without your phone.

Turn it on for your most important accounts:

1. **Google:** go to your Google Account › Security › 2-Step Verification.
2. **Facebook and Messenger:** Settings › Accounts Center › Password and security › Two-factor authentication.
3. **Instagram and TikTok:** look under Security in the app’s settings.

> **Important:** The code you get is called an **OTP** (one-time PIN). **Never share it with anyone.** No real bank, e-wallet, school or company will ever ask you for your OTP, password or MPIN.

## 4. Stay safe on shared computers

On a computer at school, a library or an internet café:

- **Use a private or guest window,** so your details aren’t saved.
- **Don’t let the browser save your password.**
- **Sign out when you’re done,** then close the browser. Closing the window alone doesn’t always sign you out.

## 5. Keep your phone safe

- **Install updates** for your phone and apps. Many updates fix security holes that attackers already know about.
- **Lock your screen** with a PIN, pattern or fingerprint.
- **Only install apps** from the Play Store or App Store.
- **Check app permissions.** A flashlight app doesn’t need your contacts or location.

## Try it

1. Run the Google Security Checkup on your Google account.
2. Turn on 2-step verification for your email.
3. Check your email on Have I Been Pwned. If it shows up in a leak, change that password.

## Key points

- Long passphrases beat short, complicated passwords.
- Every important account gets its own password.
- 2-step verification stops most account takeovers.
- Never share your password, OTP or MPIN — with anyone.
$md$),

('de000000-0000-4000-a000-000000000302', 'safety', 'intermediate',
 'spot-scams-and-phishing',
 'Spot scams, phishing and fake offers',
 'Learn the signs of a scam message, check a link before you tap it, and know what to do if you already clicked.',
 '[
   {"label": "Cybercrime Investigation and Coordinating Center (CICC)", "url": "https://cicc.gov.ph"},
   {"label": "PNP Anti-Cybercrime Group", "url": "https://acg.pnp.gov.ph"},
   {"label": "STOP. THINK. CONNECT.", "url": "https://www.stopthinkconnect.org"}
 ]',
 $md$## What you’ll learn

- The scams most often aimed at students in the Philippines
- Six warning signs of a scam message
- How to read a link to see where it really goes
- What to do if a friend’s account asks you for money
- What to do right away if you clicked or paid

## 1. Common scams

- **Fake job offers:** “Earn ₱500 a day just liking videos!” They pay you a little at first, then ask you to “invest” to earn more.
- **Text messages with links:** “Your parcel is on hold” or “Your account will be locked”, with a link to a fake site. Scams by text are called *smishing*.
- **Fake bank and e-wallet messages:** they copy the logo and colors of a real bank or e-wallet and ask you to “verify” your account.
- **“You won!” raffles and giveaways:** you never joined, but you have to pay a “fee” to claim the prize.
- **Online selling scams:** the seller asks you to pay first, then disappears. Or a “buyer” sends a fake payment screenshot.
- **Hacked friends:** a friend’s account messages you asking to borrow money or for a code that was “sent to you by mistake”.

## 2. Six warning signs

1. **They rush you:** “within 24 hours”, “last chance”, “your account will be closed”.
2. **It’s too good to be true:** big money for little work, or a prize you didn’t enter for.
3. **They ask for your OTP, password, MPIN or card number.** Real companies never do.
4. **The sender looks off:** a personal number, or an email address that isn’t the company’s.
5. **The link is strange:** shortened links, odd spellings, or a name you don’t recognize.
6. **They ask you to pay in an odd way:** gift cards, crypto, or to a personal account.

## 3. Read the link before you tap

On a computer, rest your mouse on a link to see where it really goes. On a phone, press and hold the link.

The real website is the part **just before the first single slash**, read from right to left:

| Link | Really goes to |
| --- | --- |
| `https://yourbank.com.ph/login` | `yourbank.com.ph` ✅ |
| `https://yourbank.com.ph.verify-account.top/login` | `verify-account.top` ❌ |
| `https://y0urbank-ph.com/login` | `y0urbank-ph.com` ❌ (a zero, not an o) |

> **Tip:** Anyone can type a company’s name into an email or a message. Instead of tapping the link, **open the company’s official app or type its address yourself.**

## 4. When a “friend” asks for money

Accounts get hacked all the time, and attackers use them to message the owner’s friends.

- **Check another way:** call your friend, or ask them something only they would know.
- **Never send a code** that was “sent to you by mistake”. It’s usually the code to take over *your* account.
- **Warn your friend** if their account was taken.

## 5. If you clicked or paid

Act fast. The sooner you act, the more you can save.

1. **Change your password** on the account you entered, and on any other account that used the same one.
2. **Call your bank or e-wallet’s official hotline** right away if you shared card details, an OTP or sent money. Ask them to block the account or the transaction.
3. **Turn on 2-step verification** if you haven’t yet.
4. **Save proof:** screenshots of the messages, the link, the account name and any receipts.
5. **Report it** to the app, and to the CICC (hotline 1326) or the PNP Anti-Cybercrime Group.
6. **Warn your friends and family,** so they don’t fall for the same scam.

Falling for a scam doesn’t mean you’re foolish. Scammers are good at what they do. What matters is acting quickly and telling someone.

## Try it

1. Find a suspicious text or email you received. Which of the six warning signs does it show?
2. Press and hold a link in a message and read where it really goes.
3. Save your bank or e-wallet’s official hotline in your contacts.

## Key points

- Rush, too-good offers and requests for codes are the biggest red flags.
- The real site is the part just before the first single slash.
- Check a friend’s money request another way before you send anything.
- If you clicked or paid: change passwords, call your bank, save proof and report.
$md$),

('de000000-0000-4000-a000-000000000303', 'safety', 'advanced',
 'protect-your-data-and-wellbeing',
 'Protect your data, your rights and your wellbeing',
 'Know your rights under the Data Privacy Act, control what apps collect, and keep a healthy balance with screens.',
 '[
   {"label": "National Privacy Commission: the Data Privacy Act", "url": "https://privacy.gov.ph/data-privacy-act/"},
   {"label": "Google Digital Wellbeing", "url": "https://wellbeing.google"},
   {"label": "Cybercrime Investigation and Coordinating Center (CICC)", "url": "https://cicc.gov.ph"}
 ]',
 $md$## What you’ll learn

- What counts as your personal data
- Your rights under the Data Privacy Act of 2012
- How to control what apps and websites collect
- How to stay safe on public Wi-Fi
- How to keep screens from hurting your sleep and mood
- What to do if someone threatens you online

## 1. What counts as personal data

**Personal information** is anything that can identify you: your name, birthday, address, phone number, school ID, photos, voice and location.

Some of it is **sensitive personal information**, which needs extra care: your age, health, religion, government ID numbers and school records, among others.

Every time you sign up for an app, join a raffle or answer an online quiz, you may be handing some of it over.

## 2. Your rights under the Data Privacy Act

The **Data Privacy Act of 2012** (Republic Act 10173) protects your personal information in the Philippines. It gives you these rights:

- **To be informed** that your data is being collected, and why.
- **To object** to your data being collected or used.
- **To access** the data a company or school has about you.
- **To correct** data about you that’s wrong.
- **To have it erased or blocked** when it’s no longer needed or was collected unfairly.
- **To get your data in a form you can take** to another service (data portability).
- **To claim damages** if you were harmed by misuse of your data.
- **To file a complaint** with the National Privacy Commission (NPC).

> **Tip:** Before you agree to share your data, look for a privacy notice that says what is collected, why, and for how long. If there isn’t one, think twice.

## 3. Control what apps collect

- **Review app permissions** in your phone’s settings. Turn off location, camera, microphone and contacts for apps that don’t need them.
- **Choose “Only while using the app”** for location, instead of “Always”.
- **Skip quizzes and games that ask you to log in with Facebook** or ask for your birthday, your mother’s maiden name or your first pet. These answers are often security questions for your accounts.
- **Delete apps you no longer use,** and delete the account inside them first.
- **Turn off ad personalization** in your Google and Facebook settings, if you don’t want ads based on what you do.

## 4. Public Wi-Fi

Free Wi-Fi in malls, cafés and terminals is handy, but others on the same network may be able to see what you do, or set up a fake network with a real-sounding name.

- **Don’t log in to your bank or e-wallet** on public Wi-Fi. Use mobile data instead.
- **Check the network name** with the staff before you connect.
- **Look for `https://`** and the lock icon in the address bar.
- **Turn off auto-connect** so your phone doesn’t join open networks by itself.

## 5. Look after yourself, not just your data

Being safe online also means feeling okay.

- **Protect your sleep.** Put your phone away an hour before bed, or use bedtime mode. Scrolling until 2 AM makes the next day harder.
- **Use screen time tools** (Digital Wellbeing on Android, Screen Time on iPhone) to see how long you spend on each app and set limits.
- **Turn off notifications** you don’t need. Fewer pings means fewer distractions.
- **Remember that feeds are highlight reels.** Comparing your everyday life with other people’s best moments isn’t fair to you.
- **Take breaks** when online arguments or bad news leave you upset.

## 6. If someone threatens you online

If someone threatens to share private photos or messages of you unless you pay or send more, this is called **sextortion**, and it is a crime.

- **Don’t pay and don’t send anything more.** Paying rarely makes it stop.
- **Don’t delete the messages.** Save screenshots and the account’s name and link.
- **Block and report** the account in the app.
- **Tell a trusted adult,** and report it to the CICC (hotline 1326) or the PNP Anti-Cybercrime Group.

It’s never your fault, and you don’t have to handle it alone.

## Try it

1. Open your phone’s app permissions and turn off one you don’t need.
2. Check your screen time for the past week. Which app took the most time?
3. Read the privacy notice of one app you use. What does it collect, and why?

## Key points

- Your personal data is valuable; share only what’s needed.
- The Data Privacy Act gives you the right to know, access, correct, object and complain.
- Limit app permissions, and use mobile data instead of public Wi-Fi for money matters.
- Sleep, limits and breaks are part of staying safe online.
- If you’re threatened, don’t pay, save proof, and tell someone.
$md$);

-- Areas by code. A slug that's taken, or a second published lesson for an area and tier
-- (lessons_one_published_per_tier_idx), skips that lesson instead of failing the whole run.
insert into lessons (id, area_id, tier, slug, title, summary, body_md, resources, is_published)
select l.id, a.id, l.tier, l.slug, l.title, l.summary, l.body_md, l.resources, true
from dev_lessons l
join competency_areas a on a.code = l.area_code
on conflict do nothing;

commit;
