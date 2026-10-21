"""Every number the delivery and accessibility tools enforce, with where it comes from. Grades: `platform` (a published platform or standards
document), `study`, `practitioner`, or `house` (a pack default we chose; change it freely). The cited documents are listed with links in
docs/evidence/launch-video-patterns.md (section on reading speed) and docs/DELIVERY-AND-ACCESSIBILITY.md. Re-check platform numbers before a paid delivery."""

SUBTITLE_GUIDE = 'a streaming timed-text style guide (docs/evidence/launch-video-patterns.md, reading-speed table)'

CAPTIONS = {
    'max_chars_line': {'v': 42, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': 42 characters a line'},
    'max_lines': {'v': 2, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': 2 lines'},
    'cps_adult': {'v': 20.0, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': 20 characters per second for adult programmes'},
    'cps_kids': {'v': 17.0, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': 17 characters per second for children (also the pack phone-audience ceiling)'},
    'min_dur_s': {'v': 5.0 / 6.0, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': an event stays at least 5/6 s'},
    'max_dur_s': {'v': 7.0, 'grade': 'platform', 'src': SUBTITLE_GUIDE + ': an event stays at most 7 s'},
    'gap_frames': {'v': 2, 'grade': 'practitioner', 'src': 'common subtitling practice: at least 2 frames between consecutive events so a change registers'},
    'chain_s': {'v': 0.5, 'grade': 'house', 'src': 'a gap shorter than this is closed to the 2-frame minimum (events chain) so captions do not blink off and on'},
    'split_gap_s': {'v': 1.5, 'grade': 'house', 'src': 'a pause longer than this always ends an event'},
    'burn_px_tall': {'v': 64, 'grade': 'house', 'src': 'frame-design / eyes caption floor on 9:16 (64-80 px at 1080 wide)'},
    'burn_px_wide': {'v': 48, 'grade': 'house', 'src': 'frame-design caption floor on 16:9 is 40 px at 1080 high; 48 leaves margin on a phone'},
    'em_width': {'v': 0.56, 'grade': 'house', 'src': 'average advance of the pack sans (Manrope) as a share of the font size, the estimate type/gfx/core.js textW uses'},
}

# words that should not end line 1 (or end an event): they bind to the word after them. House list modelled on published subtitle line-break advice
# (keep article + noun, preposition + object, auxiliary + verb, pronoun + verb together).
GLUE = frozenset('''a an the this that these those my your his her its our their some any no every each
of to in on at by for with from into onto upon about over under after before between through during without within than as
and or but nor so yet if because while when where whether although though unless until
is am are was were be been being has have had do does did will would shall should can could may might must
i you he she it we they not very more most'''.split())

SENTENCE_END = ('.', '?', '!', '…')
CLAUSE_END = (',', ';', ':', '—', '–')

READING = {   # on-screen text (not captions); the eyes manifest holds the same numbers and is the source a11y_check reads at run time
    'words_per_s_max': {'v': 3.5, 'grade': 'house', 'src': 'frame-design reading rule (eyes/manifest.json readability.words_per_s_max)'},
    'hold': {'v': 'max(0.5, 0.35 + 0.28 * words) s', 'grade': 'house', 'src': 'type/presets.js holdTime, eyes/manifest.json readability'},
}

FLASH = {
    'max_per_s': {'v': 3, 'grade': 'platform', 'src': 'WCAG 2.x success criterion 2.3.1 (three flashes or below threshold); eyes/manifest.json flashes'},
}

CVD = {
    'model': {'v': 'Machado, Oliveira & Fernandes 2009, severity 1.0, linear RGB', 'grade': 'study', 'src': 'IEEE TVCG 15(6) 2009, "A physiologically-based model for simulation of color vision deficiency"'},
    'collapse_de': {'v': 10.0, 'grade': 'house', 'src': 'a pair closer than CIEDE2000 10 under a simulation reads as one colour at video size and speed'},
    'distinct_de': {'v': 15.0, 'grade': 'house', 'src': 'only pairs at least this far apart for typical vision are tested (closer pairs are not meant to be told apart)'},
}

AD = {
    'wps': {'v': 2.6, 'grade': 'house', 'src': 'about 155 words a minute, a calm narration pace; set it to your describer'},
    'lead_s': {'v': 0.15, 'grade': 'house', 'src': 'start a description this long after the speech before it ends'},
    'tail_s': {'v': 0.2, 'grade': 'house', 'src': 'end a description this long before the next speech starts'},
    'speech_merge_s': {'v': 0.35, 'grade': 'house', 'src': 'word gaps shorter than this are inside speech, not a gap a description can use'},
}
