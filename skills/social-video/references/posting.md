# Posting: browser, scheduler and upload gotchas

These cost real time in practice. Most apply when an agent drives a browser for the user; some apply to people too.

## Before you touch a composer

- **Approval first.** Every publish, schedule, comment and settings change needs the user's explicit approval for that action. Prepare `post/` and ask.
- **Is the site reachable?** Some networks block a platform outright (a TLS reset while other sites load). Test once; if blocked, stage the files and captions for the user's phone instead of retrying.
- **Is the tab visible?** Some composers (notably X, LinkedIn and Instagram on the web) stall video processing or silently drop the file when the browser tab is in the background, the window is minimised or the browser sits behind other apps. Check `document.visibilityState` in the page; if it is `hidden`, ask the user to bring the tab to the front. YouTube Studio processes uploads on its servers and usually works anyway.

## Uploading

- **Size caps on automation tools:** some browser-automation upload tools accept about 10 MB per file. Make a copy with `scripts/upload_copy.py` (two-pass x264, AAC copied, PSNR printed) and upload it through the platform's own file picker.
- **Never inject a file input or upload in chunks through page scripts** to get around a cap. It looks like data exfiltration to safety systems and to the platform. If the copy is soft (PSNR under about 44 dB, or it looks soft), hand the master to the user to upload.
- **Copy the file somewhere the browser can read** (a local working folder) before uploading; cloud-synced folders can stall reads.

## In the composer

- **LinkedIn:** type the caption first in the empty composer, then add the video, then check that the caption is still there before you post or schedule; a caption typed after the media editor closes can vanish. Switch the identity to the page before commenting as the page; it does not persist between posts.
- **X:** a stalled upload can leave a draft that publishes later on its own. Discard stalled drafts. Dismiss paid-boost prompts (paid promotion is out of scope unless the user asks for it).
- **YouTube:** if Studio says it is still checking the content, go back and wait for "Checks complete" before publishing. Set the audience ("not made for kids" where true), the altered-or-synthetic answer and the thumbnail in the same session, and record each in `post/log.md`.
- **Instagram:** choose the "Original" crop for 9:16, set the cover, and confirm the AI label switch is on (it defaults off) before Share. The web app has no scheduler; use the platform's business suite for scheduled Reels or hand the post to the user's phone.
- **Search boxes are not reply boxes.** Confirm the focused field before typing a reply or a comment.

## After posting

- Record the ID or URL, the time with its time zone, and the settings used in `post/log.md`, immediately.
- Add the link comment or reply where the plan says (LinkedIn first comment, X first reply, YouTube pinned comment).
- Put a person on replies for the first hour.
- Scheduled tasks on a laptop do not run while the machine or the agent app is closed. For dated follow-ups (reading the 24 h numbers, adding a delayed link comment), use a durable scheduler and an "already done?" guard.
