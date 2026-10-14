"""motion-pack / ears / mood.py: optional zero-shot mood / genre labels per section from a LOCAL CLAP checkpoint.

Enable: point EARS_CLAP_MODEL at a local Hugging Face CLAP checkpoint directory (e.g. one you already have from
laion/clap-htsat-unfused) and install transformers + torch. Nothing is ever downloaded: the model loads with
local_files_only=True and HF_HUB_OFFLINE=1. Without both, the report says "mood: not available (no local model)".

Cloud alternative (opt-in only, paid, sends the audio to Google): `listen.py --mood gemini [--brief "..."]` calls
cloud/gemini_mood.py (Gemini 2.5 Flash on your MP_GCP_PROJECT) for whole-track mood words, energy, fit and fit to a brief.
It never runs unless asked. Its timestamps are not trusted, so it gives no per-section times; timing stays with the local checks."""
import os

import numpy as np

LABELS = ['tense', 'uplifting', 'corporate', 'playful', 'cinematic', 'cheesy', 'calm']
UNAVAILABLE = 'mood: not available (no local model)'


def available():
    path = os.environ.get('EARS_CLAP_MODEL')
    if not path or not os.path.isdir(path):
        return False, 'EARS_CLAP_MODEL is not set to a local directory'
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except Exception as e:  # pragma: no cover - depends on the machine
        return False, 'transformers / torch not importable (%s)' % type(e).__name__
    return True, path


def labels(y, sr, sections, labels=LABELS):
    """y mono float at sr (48 kHz, CLAP's own rate). sections [{'t': [a, b], ...}] -> per-section {label: probability} or an unavailable note"""
    ok, why = available()
    if not ok:
        return {'available': False, 'reason': why, 'text': UNAVAILABLE}
    os.environ.setdefault('HF_HUB_OFFLINE', '1')
    os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
    try:  # pragma: no cover - needs a local checkpoint
        import torch
        from transformers import ClapModel, ClapProcessor
        model = ClapModel.from_pretrained(why, local_files_only=True).eval()
        proc = ClapProcessor.from_pretrained(why, local_files_only=True)
        prompts = ['%s music' % k for k in labels]
        out = []
        for s in sections:
            a, b = int(s['t'][0] * sr), int(s['t'][1] * sr)
            seg = np.asarray(y[a:b], np.float32)
            if len(seg) < sr // 2:
                continue
            try:
                inp = proc(text=prompts, audios=[seg], sampling_rate=sr, return_tensors='pt', padding=True)
            except TypeError:                                      # newer transformers renamed the argument
                inp = proc(text=prompts, audio=[seg], sampling_rate=sr, return_tensors='pt', padding=True)
            with torch.no_grad():
                p = model(**inp).logits_per_audio.softmax(-1)[0].numpy()
            top = sorted(zip(labels, p.tolist()), key=lambda kv: -kv[1])
            out.append({'t': s['t'], 'labels': {k: round(v, 3) for k, v in top}, 'top': top[0][0]})
        return {'available': True, 'model': why, 'sections': out,
                'text': 'mood: ' + '; '.join('%.1f-%.1f s %s' % (o['t'][0], o['t'][1], o['top']) for o in out)}
    except Exception as e:  # pragma: no cover
        return {'available': False, 'reason': 'CLAP failed: %s' % e, 'text': UNAVAILABLE}


def gemini(path, brief=''):
    """whole-track mood from cloud/gemini_mood.py; only called when the user passes --mood gemini"""
    import sys
    pack = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(pack, 'cloud'))
    try:
        import gemini_mood
        j = gemini_mood.judge(path, brief)
    except Exception as e:
        return {'available': False, 'reason': 'gemini mood failed: %s' % e, 'text': 'mood: gemini not available (%s)' % type(e).__name__}
    words = ', '.join(j.get('mood_words') or [])
    fit = j.get('brief_fit')
    fits = ', '.join(k for k, v in (j.get('fits') or {}).items() if str(v).lower() == 'yes')
    text = 'mood (gemini, whole track): %s; energy %s/10%s%s%s' % (
        words, j.get('energy'), '; fits ' + fits if fits else '', '; brief fit %s/10' % fit if fit is not None else '',
        '; problems: ' + j['problems'] if j.get('problems') else '')
    return {'available': True, 'model': j.get('model'), 'backend': 'gemini', 'result': j, 'text': text}
