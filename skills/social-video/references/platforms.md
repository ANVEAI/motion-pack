# Platforms: specs, safe zones, loudness, disclosure, links

Platforms change limits often. Each row says where the number comes from; re-check the platform's help page before you rely on a hard limit, and note the date you checked in `post/checklist.md`.

**Basis tags:** **[pub]** published by the platform (help centre, official blog, or a public statement by its leadership); **[prac]** practitioner belief, widely repeated, not published; **[house]** this pack's default, tune it with your own numbers.

## Specs

| platform | aspect and size | length | notes |
|---|---|---|---|
| YouTube Shorts | 9:16, 1080 x 1920 (square also accepted) | up to 3 min [pub, since Oct 2024]; aim 15-35 s [house] | since 31 Mar 2025 a Short's view counts on each start or replay, with no minimum watch time [pub]; "Related video" links a Short to a long video [pub] |
| YouTube long-form | 16:9, 1920 x 1080 or larger | as needed | custom thumbnail 1280 x 720 [pub]; wait for "Checks complete" before publishing |
| Instagram Reels | 9:16, 1080 x 1920 | Reels up to 3 min are recommended to non-followers [pub, 2025]; aim 15-35 s [house] | the profile grid crops covers to a vertical rectangle (3:4 at the time of writing) [pub]; reposted content with other apps' watermarks is not recommended [pub] |
| TikTok | 9:16, 1080 x 1920 | in-app limits vary by account; aim 15-35 s [house] | the AI-generated content setting lives in the post options [pub] |
| X | 9:16 or 16:9 (16:9 for cinematic pieces) | standard accounts 2 min 20 s, 512 MB [pub]; longer for paid tiers | videos autoplay muted: burn in captions |
| LinkedIn | 16:9, 1:1 or 4:5 (aspect 1:2.4 to 2.4:1) | up to about 15 min from desktop [pub]; aim 30-60 s [house] | MP4 (H.264 + AAC) is the safe container; videos autoplay muted: burn in captions |

Machine-readable limits and CTA windows with their sources: `patterns/lengths.json` and `patterns/ctas.json` (in the pack). A YouTube or Instagram "view" now counts every start or replay; judge a hook by the 3 s hold and average view duration, not by views.

## Safe zones for vertical video

The feed overlays the title, the account name and the action buttons. Keep faces, words and the CTA inside the conservative safe rectangle: on 1080 x 1920, top 269 px, bottom 672 px, left 65 px and right 120 px are reserved (motion-pack `type/safezones.js` `conservative`, the union of conflicting sources; every per-platform row there is flagged "verify"). [house]

## Loudness

- One master at about -14 LUFS integrated: true peak -1.5 dBTP on the WAV master, at or below -1.0 dBTP decoded from the delivered MP4 (motion-pack's master spec). [house]
- YouTube normalises playback toward about -14 LUFS and turns loud content down; it does not boost quiet content. [pub]
- Instagram, TikTok, X and LinkedIn publish no loudness target. [none published] Office viewers (LinkedIn) listen quietly: keep dialogue forward and transients soft.

## AI-content disclosure: what each switch means

- **YouTube, "Altered or synthetic content":** required when realistic content was made or meaningfully altered with AI or other tools and could be mistaken for a real person, place or event; clearly unrealistic content, animation and production assistance are exempt. YouTube says the label does not limit reach. [pub] This pack: **No** for stylised CG and motion graphics; **Yes** for photoreal renders of things that do not exist yet, generated people, or realistic generated scenes. When a film mixes both, any photoreal shot makes it Yes.
- **Instagram (Meta) AI label:** Meta asks for a label on photorealistic video or realistic audio that was digitally created or altered, and applies its own "AI info" label when it detects industry signals. [pub] The upload toggle defaults to **off**. This pack: switch it **on** for every video the pipeline makes, and confirm the switch is checked before Share. In the maker's own use, accounts that auto-posted hundreds of videos into silence ended up with an "AI-generated" badge on the profile and very low reach; the posting pattern is the likely cause rather than honest per-post labels, but that is not proven either way. Do not try to hide provenance.
- **TikTok, "AI-generated content":** TikTok requires a label on realistic AI-generated content and may label it automatically from content credentials. [pub] This pack: on whenever generated imagery, voice or photoreal renders appear.
- **X and LinkedIn:** no per-post switch you can rely on at the time of writing; LinkedIn shows content credentials when files carry them. [pub, partial] Say it in the text.
- **File metadata:** a plain ffmpeg encode carries no provenance metadata; platforms that label automatically read content credentials (C2PA) when present. Never strip or forge provenance data.

## Where links and hashtags go

| platform | clickable link | hashtags |
|---|---|---|
| YouTube | description, pinned comment | up to 3 in the description; the first three can show above the title [pub]; very long hashtag lists are ignored [pub] |
| Instagram | bio (caption links are not clickable) [pub] | 3 [house]; the platform caps hashtags per post [pub] |
| TikTok | bio | 3-5 [house] |
| X | first reply [prac: links in the post body are widely believed to cut reach] | none or one [house] |
| LinkedIn | first comment [prac: same belief] | 3-5 [house] |

## Cross-posting rules

1. Upload the master for each aspect; never another platform's download. [pub for Instagram]
2. 9:16 to Shorts, Reels, TikTok and X; 16:9 to LinkedIn and YouTube long-form; cinematic films also 16:9 on X. [house]
3. A different title, caption, first comment and hashtag set per platform. [house]
4. At least 2 hours between posts on one platform; at most 2 new posts per platform per day during a release. [house]
5. A long-form cut linked from a Short must pay off the Short's promise in its first 5-10 seconds. [pub guidance from YouTube's creator blog]
