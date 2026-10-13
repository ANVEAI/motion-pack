"""Phone, desktop and AI-UI sounds (owned, word-free). Tonal cues sit in A major like the rest of the ui family. The voice-assistant product-demo set (ui.mic_on,
ui.mic_off, ui.listening_loop, ui.ai_think_pulse, ui.ai_reply) is original and deliberately unlike any OS assistant chime."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, rng, add_at, note_hz
from mpaudio.registry import snd

A5, CS6, E6, FS6, A6, B5, E5 = 880.0, 1108.73, 1318.51, 1479.98, 1760.0, 987.77, 659.26


def _d(id, tags, desc, seed, tier=3, use=("ad", "talking_head", "launch"), pairs=("cut", "caption"), tonal=False, cat="device", **kw):
    fam = "family:" + cat
    return snd(id, cat, [fam, "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc, tonal=tonal, seed=seed, **kw)


def tone(f, dur, a=0.002, tau=0.05, kind="sine", n=None):
    n = n or sec(dur)
    t = t_of(n)
    if kind == "tri":
        y = dsp.tri_n(np.full(n, f), n)
    else:
        y = np.sin(dsp.TWO_PI * f * t) + 0.15 * np.sin(dsp.TWO_PI * 2 * f * t)
    return y * env_ad(t, a, tau)


def seq(notes, gap, dur, **kw):
    y = np.zeros(sec(gap * len(notes) + dur))
    for k, f in enumerate(notes):
        add_at(y, tone(f, dur, **kw), sec(k * gap))
    return y


def click(seed, fc=3800, tau=0.002, g=1.0):
    n = sec(0.03)
    return svf(white(n, seed), fc, 1.8, "bp") * env_ad(t_of(n), 0.0002, tau) * g * 3


# ---------------------------------------------------------------- phone / desktop
@_d("snd.device.phone_buzz", ["anchor:noise", "size:m", "rr:4"], "phone vibrating on a table: two motor pulses with rattle", 430, tier=2, pairs=("cut", "hardCut"))
def phone_buzz(seed):
    y = np.zeros(sec(1.0))
    for k in range(2):
        n = sec(0.36)
        t = t_of(n)
        f = 168 * (1 + 0.02 * np.sin(dsp.TWO_PI * 3 * t))
        m = np.abs(np.sin(dsp.phase(f)))
        rat = svf(white(n, seed + k), 2200, 2.0, "bp") * (m > 0.92) * 1.5
        body = (m - m.mean()) + 0.3 * np.sin(dsp.phase(f * 2))
        e = np.minimum(t / 0.02, 1) * np.where(t > 0.32, (0.36 - t) / 0.04, 1)
        add_at(y, (body * 0.7 + rat) * e, sec(k * 0.5))
    return y


@_d("snd.device.phone_ring_synth", ["anchor:crest", "size:l", "key:A", "mood:warm"], "original synth ringtone: two bars of an A major marimba-bell figure", 431, tonal=True,
    tier=2, use=("short_film", "ad", "mime"), pairs=("cut",))
def phone_ring(seed):
    notes = [A5, E6, CS6, E6, A6, E6, CS6, B5]
    y = np.zeros(sec(2.4))
    for rep in range(2):
        for k, f in enumerate(notes):
            add_at(y, I.marimba(f, 0.1, 0.9, seed), sec(rep * 1.1 + k * 0.12))
            add_at(y, I.bell(f * 2, 0.3, 0.3, 2.0, 1.0), sec(rep * 1.1 + k * 0.12), 0.3)
    return y


@_d("snd.device.message_sent", ["anchor:crest", "size:xs", "key:A"], "message sent: quick upward swoop blip", 432, tonal=True, cat="device")
def msg_sent(seed):
    n = sec(0.22)
    t = t_of(n)
    f = dsp.expo(700, 1760, np.minimum(t / 0.06, 1))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.003, 0.05)
    return y + dsp.hp(white(n, seed), 4000) * dsp.env_bell(n, 0.3, 2, 3) * 0.08


@_d("snd.device.message_received", ["anchor:crest", "size:xs", "key:A"], "message received: two soft bell notes E6 -> A5", 433, tonal=True)
def msg_recv(seed):
    return seq([E6, A5], 0.09, 0.4, a=0.002, tau=0.09, kind="tri")


@_d("snd.device.mouse_click", ["anchor:crest", "size:xs", "rr:4"], "mouse click: press + release micro clicks", 434, use=("talking_head", "ad", "kinetic"))
def mouse_click(seed):
    y = np.zeros(sec(0.1))
    add_at(y, click(seed, 4200, 0.0015, 1.2), 0)
    add_at(y, click(seed + 1, 5200, 0.0012, 0.6), ms(55))
    return y


@_d("snd.device.keyboard_mech_soft", ["anchor:crest", "size:xs", "rr:4", "typing"], "mechanical keyboard, linear switch: low thock on bottom-out", 435, use=("talking_head", "kinetic", "ad"))
def kb_soft(seed):
    r = rng(seed)
    n = sec(0.12)
    t = t_of(n)
    f = 380 * (1 + 0.1 * r.random())
    return np.sin(dsp.TWO_PI * f * t) * env_ad(t, 0.0008, 0.012) + svf(white(n, seed), 1500, 1.2, "bp") * env_ad(t, 0.0003, 0.006) * 1.5


@_d("snd.device.keyboard_mech_clack", ["anchor:crest", "size:xs", "rr:4", "typing"], "mechanical keyboard, clicky switch: sharp click then clack", 436, use=("talking_head", "kinetic", "ad"))
def kb_clack(seed):
    n = sec(0.12)
    y = click(seed, 4800, 0.0015, 1.2)
    y = np.pad(y, (0, n - len(y)))
    add_at(y, svf(white(sec(0.05), seed + 1), 1900, 1.2, "bp") * env_ad(t_of(sec(0.05)), 0.0003, 0.007) * 3, ms(9))
    return y


@_d("snd.device.loading_tick", ["anchor:crest", "size:xs", "rr:4"], "soft wooden loading tick (spinner step)", 437, tonal=True, use=("ad", "kinetic", "launch"))
def loading_tick(seed):
    n = sec(0.06)
    t = t_of(n)
    return dsp.modal(1640.0, (1.0, 2.7), (1.0, 0.3), (0.03, 0.015), n, seed=seed) * 1.0 + np.sin(dsp.TWO_PI * 820 * t) * env_ad(t, 0.0005, 0.006) * 0.3


@_d("snd.device.progress_fill", ["anchor:end", "size:m", "key:A"], "progress bar fill: rising tone with accelerating ticks, lands on a ding (anchor = the ding)", 438, tonal=True,
    kind="fixed", use=("ad", "launch", "kinetic"), pairs=("maskReveal", "cut"))
def progress_fill(seed):
    L = sec(0.9)
    t = t_of(L)
    f = dsp.expo(440, 880, t / 0.9)
    y = np.sin(dsp.phase(f)) * (0.12 + 0.2 * t / 0.9)
    rate = np.cumsum(dsp.expo(6, 30, t / 0.9) / dsp.SR)
    ticks = np.diff(np.floor(rate), prepend=0.0)
    y += svf(ticks, 3000, 4.0, "bp") * 3
    out = np.zeros(sec(1.5))
    add_at(out, y, 0)
    add_at(out, I.bell(A6, 0.5, 0.5, 3.0, 1.0) * 1.2, L)
    return out, L


@_d("snd.device.card_flip", ["anchor:noise", "size:xs", "rr:4"], "card flip: flick snap + air", 439, use=("ad", "kinetic", "mime"), pairs=("push", "cut"))
def card_flip(seed):
    n = sec(0.18)
    t = t_of(n)
    return svf(white(n, seed), 2000, 1.0, "bp") * env_ad(t, 0.0003, 0.01) * 1.5 + svf(white(n, seed + 1), 3500, 1.0, "bp") * dsp.env_bell(n, 0.25, 1.5, 3) * 0.3


@_d("snd.device.level_up", ["anchor:end", "size:m", "key:A", "mood:playful"], "level up: fast square arpeggio A5 C#6 E6 A6 with sparkle (anchor = top note)", 440, tonal=True,
    kind="fixed", use=("ad", "mime", "kinetic"), pairs=("flash", "cut"))
def level_up(seed):
    from mpaudio import instruments_ext as X
    y = np.zeros(sec(0.9))
    for k, f in enumerate((A5, CS6, E6, A6)):
        add_at(y, X.chip(f, 0.09 if k < 3 else 0.35, 0.6, 0.5), sec(0.07 * k))
    add_at(y, I.bell(A6 * 2, 0.4, 0.4, 2.0, 1.0) * 0.3, sec(0.21))
    return y, sec(0.21)


@_d("snd.device.achievement", ["anchor:crest", "size:m", "key:A", "mood:warm"], "achievement unlocked: bright bell chord + shimmer", 441, tonal=True, tier=2,
    use=("ad", "launch", "kinetic"), pairs=("flash", "maskReveal"))
def achievement(seed):
    n = sec(1.4)
    y = np.zeros(n)
    for k, f in enumerate((A5, CS6, E6, A6)):
        add_at(y, I.bell(f, 1.0, 1.0, 3.0, 1.0), ms(12 * k), 0.6)
    t = t_of(n)
    y += dsp.hp(white(n, seed), 7000) * env_ad(t, 0.05, 0.3) * 0.15
    return y


@_d("snd.device.lock", ["anchor:crest", "size:xs"], "lock: latch slide then a firm low clack", 442, use=("ad", "launch"), pairs=("cut", "hardCut"))
def lock(seed):
    y = np.zeros(sec(0.25))
    add_at(y, click(seed, 2600, 0.003, 0.8), 0)
    add_at(y, dsp.modal(900.0, (1.0, 2.6), (1.0, 0.4), (0.05, 0.03), sec(0.1), seed=seed), ms(70))
    add_at(y, click(seed + 1, 1800, 0.004, 1.2), ms(70))
    return y


@_d("snd.device.unlock", ["anchor:crest", "size:xs"], "unlock: firm clack then a light upward latch", 443, use=("ad", "launch"), pairs=("cut", "maskReveal"))
def unlock(seed):
    y = np.zeros(sec(0.25))
    add_at(y, click(seed, 1900, 0.004, 1.2), 0)
    add_at(y, dsp.modal(1250.0, (1.0, 2.6), (1.0, 0.4), (0.05, 0.03), sec(0.1), seed=seed), ms(70), 0.8)
    add_at(y, click(seed + 1, 3300, 0.002, 0.7), ms(72))
    return y


@_d("snd.device.notify_ding", ["anchor:crest", "size:s", "key:A"], "notification ding: single FM bell on E6", 444, tonal=True, use=("ad", "talking_head", "short_film"), pairs=("cut", "caption"))
def notify_ding(seed):
    return I.bell(E6, 0.8, 0.8, 4.0, 1.4)


@_d("snd.device.notify_soft", ["anchor:crest", "size:xs", "key:A"], "soft notification: two marimba notes C#6 E6", 445, tonal=True, use=("talking_head", "ad"), pairs=("caption",))
def notify_soft(seed):
    y = np.zeros(sec(0.6))
    add_at(y, I.marimba(CS6, 0.15, 0.9, seed), 0)
    add_at(y, I.marimba(E6, 0.2, 0.9, seed), ms(110))
    return y


# ---------------------------------------------------------------- voice-assistant product-demo set (category ui)
@_d("snd.ui.mic_on", ["anchor:end", "size:xs", "key:A", "voice_ui"], "mic on: rounded two-tone rise A5 -> E6 with a soft click (anchor = second tone)", 450, tonal=True, cat="ui",
    kind="fixed", use=("ad", "launch", "talking_head"), pairs=("caption", "cut"))
def mic_on(seed):
    y = np.zeros(sec(0.3))
    add_at(y, tone(A5, 0.14, 0.004, 0.035), 0)
    add_at(y, tone(E6, 0.18, 0.004, 0.05), ms(70))
    add_at(y, click(seed, 3000, 0.0015, 0.2), 0)
    return y, ms(70)


@_d("snd.ui.mic_off", ["anchor:crest", "size:xs", "key:A", "voice_ui"], "mic off: two-tone fall E6 -> A5, softer", 451, tonal=True, cat="ui", use=("ad", "launch", "talking_head"), pairs=("caption", "cut"))
def mic_off(seed):
    y = np.zeros(sec(0.3))
    add_at(y, tone(E6, 0.14, 0.004, 0.03), 0, 0.8)
    add_at(y, tone(A5, 0.18, 0.004, 0.05), ms(70), 0.7)
    return y


@_d("snd.ui.listening_loop", ["anchor:loop", "size:m", "key:A", "voice_ui", "loop"], "listening: soft breathing A-major pad pulse, 4.0 s seamless loop (sits under a waveform)", 452, tonal=True,
    cat="ui", loop=True, kind="fixed", use=("ad", "launch"), pairs=("cut",))
def listening(seed):
    n = sec(4.0)
    t = t_of(n)
    y = np.zeros(n)
    for f, g in ((440.0, 0.5), (554.25, 0.0), (659.25, 0.35), (880.0, 0.2)):
        fr = round(f * 4) / 4
        y += g * np.sin(dsp.TWO_PI * fr * t)
    y += 0.25 * np.sin(dsp.TWO_PI * 554.25 * t)  # 554.25 Hz = 2217 cycles over 4 s: wraps exactly
    br = 0.55 + 0.45 * np.sin(dsp.TWO_PI * 1.0 * t - np.pi / 2) ** 2
    return y * br


@_d("snd.ui.ai_think_pulse", ["anchor:end", "size:s", "key:A", "voice_ui"], "AI thinking: three soft rising bubble pulses (anchor = last pulse)", 453, tonal=True, cat="ui", kind="fixed",
    use=("ad", "launch"), pairs=("caption", "cut"))
def ai_think(seed):
    y = np.zeros(sec(0.9))
    for k, f in enumerate((A5, B5, CS6)):
        n = sec(0.22)
        t = t_of(n)
        v = np.sin(dsp.phase(f * (1 + 0.06 * (1 - np.exp(-t / 0.03))))) * dsp.env_bell(n, 0.3, 1.5, 2.5)
        add_at(y, v, sec(0.2 * k), 0.6 + 0.2 * k)
    return y, sec(0.4) + sec(0.066)


@_d("snd.ui.ai_reply", ["anchor:crest", "size:m", "key:A", "voice_ui", "mood:warm"], "AI reply: gentle bloom, A major bell chord with an upward sparkle", 454, tonal=True, cat="ui",
    tier=2, use=("ad", "launch"), pairs=("maskReveal", "caption"))
def ai_reply(seed):
    n = sec(1.1)
    y = np.zeros(n)
    for k, f in enumerate((A5, CS6, E6)):
        add_at(y, I.bell(f, 0.8, 0.8, 1.5, 1.0) * np.sin(np.linspace(0, np.pi / 2, sec(1.0))) ** 0.5, ms(25 * k), 0.6)
    t = t_of(n)
    sp = np.sin(dsp.phase(dsp.expo(1760, 3520, np.minimum(t / 0.25, 1)))) * env_ad(t, 0.01, 0.08) * 0.15
    return y + sp
