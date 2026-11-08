-- DigiBridge dev question bank: the 3 areas and 39 practice items for testing the assessment.
--
-- 13 items per area: 5 basic, 5 intermediate, 3 advanced, so each attempt picks a random
-- 4 / 4 / 2 from them (ASM-01). Each item has 4 choices with 1 correct, and at least 3 per area
-- are scenario items (no images yet: uploads come in Stage 3). The columns follow the question
-- import CSV (TRD): area_code, difficulty, stem, choice_a to choice_d, correct (a to d),
-- explanation, is_scenario.
--
-- Run it once in the Supabase SQL editor (paste and Run), after `pnpm db:push`. It is safe to
-- run again: rows that are already there are left as they are, so edits here won't reach rows
-- already loaded. Every item's ID starts with de000000-, so the bank can be switched off before
-- the pilot (Build plan, Stage 4) with:
--
--   update questions set is_active = false where id::text like 'de000000-%';
--
-- Text uses typographic quotes (’ “ ”), so no SQL escaping is needed. In a stem, a blank line
-- starts a new paragraph, and a paragraph wrapped in “ and ” (a text, a post, an email) is shown
-- as a quote on the assessment page.

begin;

-- The 3 DigComp areas (names match AREA_LABELS in packages/shared).
insert into competency_areas (code, name, description, sort_order) values
  ('info_literacy', 'Information and data literacy',
   'Finding what you need online, and knowing whether you can trust it.', 0),
  ('communication', 'Communication and collaboration',
   'Working with others online, and knowing how to act in chats, groups and classes.', 1),
  ('safety', 'Online safety',
   'Keeping your accounts, your devices, your personal data and yourself safe.', 2)
on conflict (code) do nothing;

create temp table dev_items (
  id uuid primary key,
  area_code text not null,
  difficulty difficulty not null,
  is_scenario boolean not null,
  stem text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct char(1) not null check (correct in ('a', 'b', 'c', 'd')),
  explanation text not null
) on commit drop;

insert into dev_items values

-- ---------- Information and data literacy ----------

('de000000-0000-4000-8000-000000000101', 'info_literacy', 'basic', false,
 'You want to know how to apply for a CHED scholarship. Which search will most likely give you useful results?',
 'CHED scholarship application requirements 2026',
 'scholarship',
 'help me please money for school',
 'how to',
 'a',
 'Specific keywords (who, what, when) narrow the results to pages about exactly what you need.'),

('de000000-0000-4000-8000-000000000102', 'info_literacy', 'basic', false,
 'Which website address is most likely the official site of a Philippine government agency?',
 'dost-gov-ph.blogspot.com',
 'dost-official-ph.net',
 'www.dost.gov.ph',
 'dost.ph.freesite.com',
 'c',
 'Philippine government sites end in .gov.ph. Look-alike names on blogs or free hosting can be made by anyone.'),

('de000000-0000-4000-8000-000000000103', 'info_literacy', 'basic', false,
 'You downloaded your class schedule as a PDF. What is the best way to keep it so you can find it later?',
 'Leave it in Downloads with its name, “file(3).pdf”.',
 'Delete it after reading, since you can download it again.',
 'Send it to yourself on Messenger.',
 'Rename it “Class schedule 1st sem.pdf” and put it in a folder called “School 2026”.',
 'd',
 'A clear file name and a folder for each subject or term make files easy to find, even months later.'),

('de000000-0000-4000-8000-000000000104', 'info_literacy', 'basic', false,
 'An article online has no author, no date and lots of pop-up ads. What does this tell you?',
 'It may not be reliable, so check what other sources say.',
 'It is reliable, because it is on the internet.',
 'It is reliable, because it has many ads, so many people read it.',
 'It is fake for sure, so report it.',
 'a',
 'No author or date is a warning sign, not proof. Compare it with trusted sources before you believe it.'),

('de000000-0000-4000-8000-000000000105', 'info_literacy', 'basic', false,
 'What happens when you put quotation marks around words in a Google search, like “digital literacy”?',
 'Google looks for that exact phrase.',
 'Google ignores those words.',
 'Google shows only news articles.',
 'Google translates the words into English.',
 'a',
 'Quotation marks tell the search engine to find pages with those words together, in that order.'),

('de000000-0000-4000-8000-000000000106', 'info_literacy', 'intermediate', true,
 'A Facebook page called “Balita Ngayon PH” posts:

“BREAKING: Classes are suspended in all Cebu schools tomorrow! Share so everyone knows!”

There is no link to DepEd or the city government. What is the best thing to do?',
 'Share it right away so your classmates know.',
 'Believe it, because many people have already shared it.',
 'Check DepEd’s or your city’s official page before you believe or share it.',
 'Comment “Is this true?” and wait for replies.',
 'c',
 'Class suspensions are announced by DepEd, CHED or the local government. Check the official source first; shares don’t make a post true.'),

('de000000-0000-4000-8000-000000000107', 'info_literacy', 'intermediate', true,
 'A post shows a bar chart titled “Phone use DOUBLED this year!” The bars are for last year (92%) and this year (96%), and the chart’s side starts at 90%, not 0%. What is wrong with the chart?',
 'Nothing, the numbers are correct.',
 'The chart should be a pie chart.',
 'The bars are the wrong color.',
 'Starting at 90% makes a small change look huge. Phone use only went up by 4 points.',
 'd',
 'A chart whose side doesn’t start at zero can make small differences look big. Always read the numbers, not just the bars.'),

('de000000-0000-4000-8000-000000000108', 'info_literacy', 'intermediate', false,
 'You are writing a research paper about typhoons in the Philippines. Which source is the most reliable?',
 'A report from PAGASA or an article in a reviewed science journal',
 'A TikTok video with a million views',
 'A comment on a Facebook post',
 'A blog that doesn’t list its sources',
 'a',
 'Government science agencies and reviewed journals check their facts and name their sources, so you can trace where the information came from.'),

('de000000-0000-4000-8000-000000000109', 'info_literacy', 'intermediate', false,
 'You found a useful paragraph online for your essay. What should you do?',
 'Copy and paste it, since it is free online.',
 'Change a few words so it doesn’t look copied.',
 'Write the idea in your own words or quote it, and cite where it came from.',
 'Use it without saying where it came from, since your teacher won’t check.',
 'c',
 'Using someone’s words or ideas without credit is plagiarism. Quote or paraphrase, and always cite the source.'),

('de000000-0000-4000-8000-000000000110', 'info_literacy', 'intermediate', false,
 'Your whole thesis is saved only on your laptop. What is the best way to make sure you don’t lose it?',
 'Keep it on the laptop and be careful not to drop it.',
 'Print it every week.',
 'Rename the file so nobody deletes it.',
 'Keep a copy in cloud storage, like Google Drive, and another on a flash drive.',
 'd',
 'A backup in more than one place means a broken, lost or stolen laptop doesn’t take your work with it.'),

('de000000-0000-4000-8000-000000000111', 'info_literacy', 'advanced', true,
 'A viral photo shows a flooded street with the caption: “Mandaue right now! Stay safe!” You think the photo may be from years ago. What is the best way to check?',
 'Zoom in to see whether the photo looks real.',
 'Do a reverse image search, like Google Lens, to find where and when it first appeared online.',
 'Count how many people reacted to it.',
 'Ask in the comments whether it is old.',
 'b',
 'A reverse image search shows earlier copies of the same photo, so you can see if it was posted long before the event it claims to show.'),

('de000000-0000-4000-8000-000000000112', 'info_literacy', 'advanced', true,
 'A website says: “A study by doctors proves this herbal drink cures dengue in 3 days!” What is the strongest reason to doubt it?',
 'The website has a nice design.',
 'The drink is sold at a low price.',
 'The study isn’t named or linked, and health authorities like the DOH don’t back the claim.',
 'The article is written in English.',
 'c',
 'Real studies can be named, found and checked. A big health claim that no health authority supports is a strong warning sign.'),

('de000000-0000-4000-8000-000000000113', 'info_literacy', 'advanced', false,
 'Search engines and social media show you posts based on what you clicked before. What is the main risk of this?',
 'Your phone’s battery runs out faster.',
 'You mostly see views you already agree with, so you may miss other sides of a story.',
 'You see fewer ads.',
 'Your posts are deleted after a while.',
 'b',
 'This is called a filter bubble. Look for different sources on purpose to get the full picture.'),

-- ---------- Communication and collaboration ----------

('de000000-0000-4000-8000-000000000201', 'communication', 'basic', false,
 'You need to ask your teacher on Messenger about a deadline you missed. Which message is best?',
 '“sir/maam pasa ko later ha”',
 '“Good afternoon, Ma’am. This is Ana Cruz from BSIT 1-A. I missed the deadline for Activity 3 because I was sick. May I still submit it tomorrow? Thank you.”',
 '“???”',
 '“Ma’am why is the deadline so early”',
 'b',
 'A greeting, your name and section, and a clear, polite question help your teacher understand and answer quickly.'),

('de000000-0000-4000-8000-000000000202', 'communication', 'basic', false,
 'What does typing in ALL CAPITAL LETTERS usually mean in an online chat?',
 'You are shouting.',
 'You are being extra polite.',
 'Your message is a secret.',
 'Your keyboard is broken.',
 'a',
 'Most people read all caps as shouting, so use them sparingly.'),

('de000000-0000-4000-8000-000000000203', 'communication', 'basic', false,
 'Which tool lets your whole group edit the same report at the same time, each on their own phone or laptop?',
 'Notepad on one person’s laptop',
 'A printed copy passed around',
 'A PDF file sent by email',
 'Google Docs or another online document',
 'd',
 'Online documents let everyone write, comment and see changes at the same time.'),

('de000000-0000-4000-8000-000000000204', 'communication', 'basic', false,
 'You took a funny photo of your friends. What should you do before you post it?',
 'Ask your friends if they are OK with it being posted.',
 'Post it right away while it is still funny.',
 'Post it, then delete it if someone complains.',
 'Post it, but only on your story.',
 'a',
 'Other people get a say in photos of them. Asking first shows respect for their privacy.'),

('de000000-0000-4000-8000-000000000205', 'communication', 'basic', false,
 'In an online class on Google Meet, what should you do while you are not talking?',
 'Keep your microphone on so the teacher knows you are there.',
 'Leave the call and come back later.',
 'Mute your microphone.',
 'Play music softly.',
 'c',
 'Muting stops background noise from interrupting the class. Unmute when it’s your turn to talk.'),

('de000000-0000-4000-8000-000000000206', 'communication', 'intermediate', true,
 'In your class group chat, someone posts a meme making fun of a classmate’s looks. A few people send laughing reactions. What is the best thing to do?',
 'Send a laughing reaction too, so you fit in.',
 'Leave the group chat without saying anything.',
 'Share the meme with your other friends.',
 'Don’t join in, tell the poster privately that it’s hurtful, and check on your classmate.',
 'd',
 'Not joining in and speaking up kindly can stop bullying from growing. Supporting the person being teased matters too.'),

('de000000-0000-4000-8000-000000000207', 'communication', 'intermediate', true,
 'Your group report is due in 2 days. One member hasn’t done their part and hasn’t replied in the group chat for a week. What is the best next step?',
 'Message them directly about what is needed and by when. If they still don’t reply, tell your teacher and share out the work.',
 'Remove their name from the report without telling anyone.',
 'Post about them on your Facebook story.',
 'Wait until the deadline and hope they reply.',
 'a',
 'Clear, direct messages come first. If that doesn’t work, the teacher should know, and the group can still finish on time.'),

('de000000-0000-4000-8000-000000000208', 'communication', 'intermediate', false,
 'You are applying for a part-time job, and the employer may look you up online. What helps you most?',
 'Deleting all your accounts the night before.',
 'Changing your name on Facebook to a nickname.',
 'Reviewing your public posts and privacy settings, and removing posts you wouldn’t want an employer to see.',
 'Posting more selfies.',
 'c',
 'Your digital footprint is what others can find about you online. Check what is public and keep it something you’re proud of.'),

('de000000-0000-4000-8000-000000000209', 'communication', 'intermediate', false,
 'A groupmate wrote a part of your shared Google Doc, and it has some mistakes. What is the best way to point them out?',
 'Delete their part and write it yourself.',
 'Use comments or suggesting mode, so they can see and accept the changes.',
 'Screenshot the mistakes and post them in the group chat.',
 'Say nothing and let the teacher find them.',
 'b',
 'Comments and suggestions keep the edits visible and leave the final choice to the writer, which keeps the group working well together.'),

('de000000-0000-4000-8000-000000000210', 'communication', 'intermediate', true,
 'You comment on a public post about a school event. A stranger replies:

“That’s the dumbest thing I’ve read today. Do you even go to school?”

What is the best way to respond?',
 'Reply with an insult that is even worse.',
 'Post their name and photo so others can attack them.',
 'Answer once, calmly, with facts, or simply don’t reply. Block or report them if they keep going.',
 'Delete your Facebook account.',
 'c',
 'Arguing angrily usually makes things worse. Staying calm, or stepping away, keeps you safe and respectful.'),

('de000000-0000-4000-8000-000000000211', 'communication', 'advanced', false,
 'You post a rant about your school on a “private” account with 200 followers. Why could it still spread to people you didn’t choose?',
 'It can’t, because the account is private.',
 'Anyone who sees it can screenshot it and share it with anyone.',
 'Private posts become public after 24 hours.',
 'Only your teachers can see private accounts.',
 'b',
 'Private only limits who sees it first. Anyone who sees it can screenshot and share it, so post as if it could become public.'),

('de000000-0000-4000-8000-000000000212', 'communication', 'advanced', true,
 'You lead a group project. Members live in different towns, and some only have mobile data. What is the best way to hold your group meeting?',
 'Hold a 2-hour video call at a time that suits only you.',
 'Skip meetings and let everyone guess what to do.',
 'Meet only in person, even if some can’t come.',
 'Agree on a time with everyone, use a call that works on mobile data, and post short notes after for anyone who missed it.',
 'd',
 'Good online teamwork thinks about everyone’s time and connection, and keeps a record so nobody is left out.'),

('de000000-0000-4000-8000-000000000213', 'communication', 'advanced', true,
 'For weeks, a classmate has been sent mean messages and edited photos of them in a group chat. They look upset at school. What is the most helpful set of steps?',
 'Tell them to just ignore it and leave the chat.',
 'Send mean messages back to the bullies.',
 'Save screenshots as proof, report the messages to the app and to a teacher or guidance counselor, and check on your classmate.',
 'Wait for it to stop on its own.',
 'c',
 'Proof, reports to the platform and to a trusted adult, and support for the person being bullied are what actually stop cyberbullying.'),

-- ---------- Online safety ----------

('de000000-0000-4000-8000-000000000301', 'safety', 'basic', false,
 'Which of these is the strongest password?',
 'password123',
 'Bike!Mango7Tulay#Rain',
 '03152007 (your birthday)',
 'juan2007',
 'b',
 'Long passwords that mix words, numbers and symbols are hard to guess. Birthdays and names are the first things attackers try.'),

('de000000-0000-4000-8000-000000000302', 'safety', 'basic', true,
 'You get this message on Messenger:

“Hi! I’m from GCash Support. We sent a 6-digit code to your phone. Please send it to me so we can verify your account.”

What should you do?',
 'Send the code, since they are from GCash.',
 'Send only the first 3 digits.',
 'Ask them to call you first, then send the code.',
 'Don’t send it. Real support never asks for your code, so block and report the account.',
 'd',
 'A one-time code (OTP) is the key to your account. Anyone who asks you for it is trying to get in.'),

('de000000-0000-4000-8000-000000000303', 'safety', 'basic', false,
 'You used a computer at a computer shop to check your Facebook. What should you do when you are done?',
 'Log out and don’t let the browser save your password.',
 'Just close the browser window.',
 'Leave it open for the next person.',
 'Turn off the monitor.',
 'a',
 'Closing the window may keep you signed in. Always log out on shared computers, and never save passwords there.'),

('de000000-0000-4000-8000-000000000304', 'safety', 'basic', false,
 'What is two-step verification?',
 'A second check, like a code sent to your phone, on top of your password.',
 'Typing your password twice.',
 'Having two accounts on the same app.',
 'Asking a friend to remember your password.',
 'a',
 'With two-step verification, someone who steals your password still can’t get in without your phone.'),

('de000000-0000-4000-8000-000000000305', 'safety', 'basic', false,
 'You scroll on your phone until 2 AM most nights and feel tired in class. What is a good first step?',
 'Turn the screen brightness up so you stay awake.',
 'Drink more coffee in the morning.',
 'Set a screen time limit, or put your phone away an hour before bed.',
 'Switch to a different app.',
 'c',
 'Screen time tools and a phone-free hour before bed help you sleep better, which is part of staying well online.'),

('de000000-0000-4000-8000-000000000306', 'safety', 'intermediate', true,
 'You get this text message:

“LBC: Your parcel is on hold due to an unpaid fee of P35. Pay within 24 hours: lbc-ph-delivery.co/pay”

You are not expecting a parcel. What should you do?',
 'Pay the P35, since it’s a small amount.',
 'Tap the link to see what the parcel is.',
 'Reply “STOP” to the number.',
 'Don’t tap the link. Check with the courier’s official app or website if you are unsure.',
 'd',
 'Fake delivery texts use small fees and short deadlines to rush you. The link leads to a site that steals card or e-wallet details.'),

('de000000-0000-4000-8000-000000000307', 'safety', 'intermediate', true,
 'Your friend’s Facebook account messages you:

“Pa-send muna ko P500 sa GCash, emergency lang. I’ll pay you back later. Here’s the number: 0917 xxx xxxx”

It doesn’t sound like how your friend usually talks. What should you do?',
 'Call or text your friend on their number to check before sending anything.',
 'Send it fast, since it’s an emergency.',
 'Send half to be safe.',
 'Ask the account for their birthday to prove it’s them.',
 'a',
 'Hacked accounts are often used to ask friends for money. Check with the person another way first; a hacker can look up a birthday.'),

('de000000-0000-4000-8000-000000000308', 'safety', 'intermediate', false,
 'You are on free public Wi-Fi at a mall. Which of these is the riskiest thing to do?',
 'Reading the news',
 'Logging in to your online banking',
 'Checking the weather',
 'Watching a video',
 'b',
 'Others on a public network may be able to watch what you send. Wait for your mobile data or home Wi-Fi for banking and payments.'),

('de000000-0000-4000-8000-000000000309', 'safety', 'intermediate', false,
 'A flashlight app asks for access to your contacts, location and microphone. What should you do?',
 'Allow everything, since apps need permissions to work.',
 'Allow it, but only on weekends.',
 'Deny those permissions or don’t install the app. A flashlight doesn’t need them.',
 'Restart your phone, then allow everything.',
 'c',
 'Only allow permissions an app clearly needs. Extra permissions can be used to collect and sell your data.'),

('de000000-0000-4000-8000-000000000310', 'safety', 'intermediate', false,
 'Your phone keeps asking you to install a security update. What is best?',
 'Ignore it forever, since updates are annoying.',
 'Install it soon, because updates fix security holes.',
 'Only update if your friends do.',
 'Turn off updates in settings.',
 'b',
 'Security updates close weaknesses that attackers know about. Delaying them leaves your phone open.'),

('de000000-0000-4000-8000-000000000311', 'safety', 'advanced', true,
 'You get this email:

“From: BDO Unibank <security@bdo-alerts-ph.com>
Subject: URGENT: Your account will be locked in 24 hours
Click here to verify your account now.”

Which sign shows most clearly that it is a phishing email?',
 'It uses the bank’s name.',
 'It has a subject line.',
 'It was sent in the morning.',
 'The sender’s address isn’t the bank’s official domain, and it rushes you to click.',
 'd',
 'Anyone can type a bank’s name. The real tell is the sender’s domain, plus pressure to act fast. Go to the bank’s app or site yourself.'),

('de000000-0000-4000-8000-000000000312', 'safety', 'advanced', false,
 'A website you used was hacked, and your password leaked. You use the same password for Facebook and your email. What should you do?',
 'Nothing, since only that one website was hacked.',
 'Change the password on that website only.',
 'Delete the website’s app from your phone.',
 'Change the password on every account that used it, give each one its own password, and turn on two-step verification.',
 'd',
 'Attackers try leaked passwords on other sites. A different password for each account stops one leak from opening the rest.'),

('de000000-0000-4000-8000-000000000313', 'safety', 'advanced', true,
 'Someone you have chatted with online for weeks starts saying they will post your private chats unless you send them money. What should you do?',
 'Send the money so they stop.',
 'Don’t pay or send anything. Save proof, block and report them, and tell a trusted adult or the PNP Anti-Cybercrime Group.',
 'Delete all your chats and hope they forget.',
 'Threaten them back.',
 'b',
 'Paying usually leads to more demands. Proof, reports and help from trusted people and the police are the way out. It is not your fault.');

insert into questions (id, area_id, difficulty, stem, is_scenario, explanation)
select i.id, a.id, i.difficulty, i.stem, i.is_scenario, i.explanation
from dev_items i
join competency_areas a on a.code = i.area_code
on conflict (id) do nothing;

insert into choices (question_id, label, is_correct, position)
select i.id, c.label, c.letter = i.correct, c.position
from dev_items i
cross join lateral (values
  (0, 'a', i.choice_a),
  (1, 'b', i.choice_b),
  (2, 'c', i.choice_c),
  (3, 'd', i.choice_d)
) as c(position, letter, label)
on conflict (question_id, position) do nothing;

commit;

-- Check: 5 basic, 5 intermediate and 3 advanced active items per area, each with 4 choices.
-- select a.code, q.difficulty, count(*) from questions q
-- join competency_areas a on a.id = q.area_id where q.is_active group by 1, 2 order by 1, 2;
