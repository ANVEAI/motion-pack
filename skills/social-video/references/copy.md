# Copy templates, UTM builder, checklist and log

Write one file per platform in `post/copy/`. Count characters and write the count next to each field (X counts every link as 23 characters).

## YouTube (`post/copy/youtube.md`)

```markdown
**Short title** (<= ~50 chars; stake or payoff first, searchable words; 100 max):
**Long-form title** (if any):
**Description:**
<line 1: the stake, restated in plain searchable words>
<one sentence: what the viewer saw>
<the product and its honest status: runs today / in build / render / demo data>
<disclosure: "3D animation rendered in code." / "AI-assisted renders, demo figures.">
<link with UTM>
#tag1 #tag2 #tag3
**Pinned comment:** <a short question that invites a reply, or one line of how it was made>
**Altered or synthetic content:** Yes / No — <why, one line>
**Related video (Short → long):** <id or "none">
**Thumbnail:** post/covers/thumb-16x9.jpg — <the words on it>
```

## Instagram (`post/copy/instagram.md`)

```markdown
**Caption** (stake in the first 125 characters; 2,200 max):
<line 1: the stake>
<line 2-3: what happened, the product's honest status>
<a human question>
<disclosure line>
#tag1 #tag2 #tag3
**First comment:** <how it was made, or a callback; no link>
**AI label:** ON (verify the switch is checked before Share)
**Cover:** post/covers/cover-9x16.jpg — subject and words centred for the grid crop
**Crop:** Original (9:16)
```

## X (`post/copy/x.md`)

```markdown
**Post** (<= 280 chars; a verifiable fact or the stake first; no link):
**First reply:** <link with UTM> + one line of context
**Media:** 9:16 master (or 16:9 for cinematic pieces); captions burned in
**Disclosure in text:** <one line>
**Who stays to reply, and until when:**
```

## LinkedIn (`post/copy/linkedin.md`)

```markdown
**Post** (the stake in professional terms in line 1; short paragraphs; 3,000 max):
<line 1: the stake>
<what the viewer will see, and why it matters to the reader's work>
<the product's honest status>
<a question the reader can answer from experience>
#tag1 #tag2 #tag3
**First comment:** <link with UTM> + one line
**Media:** 16:9 master, captions burned in
**Order in the composer:** type the text first, then add the video, then check the text is still there before posting or scheduling
```

## TikTok (`post/copy/tiktok.md`)

```markdown
**Caption:** <the stake first; a question>  #tag1 #tag2 #tag3
**AI-generated content:** ON / OFF — <why>
**Cover:** <frame or uploaded cover>
```

## UTM builder

```
https://example.com/page?utm_source={platform}&utm_medium={surface}&utm_campaign={series-or-release}&utm_content={video-slug}[-{hook}]
platform: youtube | instagram | x | linkedin | tiktok
surface:  shorts | longform | reels | post | first_comment | pinned_comment | bio
```

- Lowercase and hyphens only; the same campaign spelling in every post of a release.
- `utm_content` carries the video slug, plus the hook variant (`-a`, `-b`, `-c`) when testing hooks, so clicks can be read per variant.
- A distinct `utm_source` for AI-assistant referrals keeps them out of social numbers.
- UTMs go only on links you post off-site. Internal links on your own site stay clean, or crawlers waste effort on duplicate URLs and your analytics double-count.

## Titles: patterns that keep the promise

| pattern | example (fictional) |
|---|---|
| the stake as a question | "Who replied-all to the whole client list?" |
| the stake as a fact | "9:58 AM. Pitch at 10. The deck won't open." |
| the payoff first | "Filed at 11:59. Here's how." |
| the relatable situation | "When the meeting could have been an email" |

Avoid: the product name first, a series label first ("Ep. 12:"), all caps, a promise the video does not pay off.

## `post/checklist.md` template

```markdown
# Post checklist: <title>   (limits checked on <date>)

## Before anything goes out
- [ ] Production QA passed (motion-pack QA list; loudness and true peak measured on the delivered file)
- [ ] Masters per aspect present; upload copies only where a tool needs them, PSNR >= 44 dB or checked by eye
- [ ] Every number in copy has a source; status words match reality; banned words absent: <list>
- [ ] Disclosure per platform decided and written below
- [ ] Covers read at 120 px wide
- [ ] Someone is named to reply in the first hour on each platform
- [ ] The user approved: <platforms, times>

## Per platform
| platform | file | slot | title/caption file | AI setting | link location | approved |
|---|---|---|---|---|---|---|
```

## `post/log.md` template

```markdown
| # | posted or scheduled (time zone) | platform | asset and aspect | ID or URL | settings (AI label, cover, crop, link) | 24 h | 72 h | 7 d | notes |
|---|---|---|---|---|---|---|---|---|---|
```

Log every post as it happens, including failures ("not posted: network blocked the site"), so the next session knows exactly what is live.
