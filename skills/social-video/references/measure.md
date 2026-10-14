# Measure: what to read, when, and what to change

Platforms publish ranking inputs in general terms (early skips, watch time, replays, shares and sends, replies) but no thresholds. So commit to the mechanisms and treat every threshold as your own baseline. The user's analytics are the only ground truth.

## Reading windows

- **24 hours:** did the post get its first test, and did strangers stay? (hook rate, swipe-away)
- **72 hours:** retention shape, average view duration, sends; most short videos have shown what they will do.
- **7 days:** long-form, search traffic, link clicks.
- Never judge at one hour. Under a few hundred views, percentages are noise: judge by the muted test and the feature-recall test with five real people instead (story-script's rubric).

## Where each number lives

| signal | YouTube (Studio) | Instagram (insights) | TikTok (analytics) | LinkedIn | X |
|---|---|---|---|---|---|
| hook / first seconds | Shorts "viewed vs swiped away" | skip rate; 3-second views where shown | retention in the first seconds; traffic source | video views vs impressions | views vs impressions |
| retention | retention graph, average view duration | average watch time, watch time | average watch time, watched full video | watch time | completion where shown |
| replays | views (replays count on Shorts) | replays where shown | rewatches in the retention curve | n/a | n/a |
| sends and shares | shares | sends, shares | shares | reposts, sends | reposts, bookmarks |
| conversation | comments, likes | comments, saves | comments | comments | replies |
| action | clicks to the UTM link in your analytics | profile visits, link-in-bio clicks | profile views | link clicks in the first comment | link clicks in the reply |

## The diagnosis ladder (fix the lowest broken rung first)

1. **No test at all** (single-digit views on every post): the account, not the video. Check account status and any restriction notices, stop automated activity, stop stacking posts, and post fewer, better videos with someone replying in the first hour. Volume added at this rung only adds silence.
2. **Tested, but strangers leave in the first two seconds** (high swipe-away or skip rate): the hook. Put the stake in motion on frame 0, give it a first sound on frames 0-3 (or plan a quiet open and let the sound enter 1-2 s later on the first visual event), remove any title card or logo bumper from the first second (a small name super over moving footage is fine; the rule is in motion-pack `references/virality.md` §1), and keep faces and text inside the safe area. Test three hooks on one body.
3. **They stay past the hook but drop before the payoff:** the structure. Move the payoff earlier or shorten the setup; check the retention graph for the exact second they leave; cut a flash-forward cold open for long films.
4. **They watch to the end but nobody shares:** the send-worthiness. Raise the stake (money, a client, a deadline, a secret beat mild banter), end on a line that names who to send it to.
5. **They share but nobody acts:** the path. One link, in the place the platform makes clickable, with a UTM; a CTA that matches what the video showed.
6. **Only then:** covers, titles for search, hashtags, posting times.

## Experiment log (`post/log.md` or a separate experiments file)

```markdown
| id | hypothesis | change (one only) | control | posts | metric and window | pass rule (written before) | result | decision |
|---|---|---|---|---|---|---|---|---|
| X1 | stake on frame 0 beats a title card | hook v2 on 3 episodes | the previous 3 | 3 + 3 | swipe-away at 72 h | v2 lower on 3 of 3 | | keep / drop |
```

- Write the pass rule before posting. Change one thing per test. Keep the body identical when testing hooks.
- Log before and after for any change to a live post or profile (title, thumbnail, description, bio), so every change can be reverted.
- Report results as numbers with their window and sample size; say "noise" when the sample is too small to tell.
