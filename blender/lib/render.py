# motion-pack/blender: render presets, calibrated on ANVE's launch film.
#   eevee_plate    motion plates: raytraced reflections, screen-space GI, soft virtual shadow maps, physical DOF, AgX,
#                  180-degree motion blur. Budget ~3 s per 1080p frame on an M3 Pro (Metal) after the shader compile.
#   cycles_keyart  key art: crisp glossy (blur_glossy 0.15, indirect clamp 15), adaptive 0.006, filter 1.0, OIDN.
#                  Determinism: fixed seed, no animated seed, no time limit (a wall-clock limit changes the sample
#                  count run to run), OIDN on the CPU (GPU OIDN measured 1/255 off between two renders).
# Every setting goes through _set, and the ones this build lacks are reported (render.json "settings.missing").
# MIT (see blender/LICENSE).
import bpy

PLATE = {
    "taa_render_samples": 32,
    "ray_resolution": "2",           # half-res raytracing, denoised
    "fast_gi_resolution": "2",
    "fast_gi_rays": 2,
    "fast_gi_steps": 8,
    "shadow_rays": 1,
    "shadow_steps": 6,
    "shadow_pool": "1024",
    "filter_size": 1.2,
    "clamp_indirect": 10.0,
    "shutter": 0.5,                  # 180-degree shutter
}
LOOK = "AgX - Medium High Contrast"


class Settings:
    def __init__(self):
        self.applied, self.missing = {}, []

    def set(self, obj, name, value, label=None):
        key = label or name
        if hasattr(obj, name):
            try:
                setattr(obj, name, value)
                self.applied[key] = value if isinstance(value, (int, float, str, bool)) else str(value)
                return True
            except (TypeError, ValueError, AttributeError) as ex:
                self.missing.append("%s (%s)" % (key, str(ex)[:60]))
                return False
        self.missing.append(key)
        return False

    def report(self):
        return {"applied": self.applied, "missing": self.missing}


def no_stamps(sc):
    """Blender writes Date / Time / RenderTime into PNG metadata by default: identical pixels would hash differently."""
    r = sc.render
    for p in r.bl_rna.properties:
        if p.identifier.startswith("use_stamp"):
            try:
                setattr(r, p.identifier, False)
            except (TypeError, AttributeError):
                pass


def color(sc, look=LOOK, exposure=0.0):
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = look
    sc.view_settings.exposure = exposure
    sc.view_settings.gamma = 1.0


def output(sc, W, H, alpha=False, depth="8", compression=15):
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
    r.film_transparent = bool(alpha)
    s = r.image_settings
    s.file_format = "PNG"
    s.color_mode = "RGBA" if alpha else "RGB"
    s.color_depth = str(depth)
    s.compression = compression
    no_stamps(sc)


def eevee_plate(sc, W, H, samples=None, motion_blur=True, alpha=False, look=LOOK, exposure=0.0, depth="8", cfg=PLATE):
    S = Settings()
    sc.render.engine = "BLENDER_EEVEE"
    e = sc.eevee
    S.set(e, "taa_render_samples", int(samples or cfg["taa_render_samples"]))
    S.set(e, "use_raytracing", True)
    S.set(e, "ray_tracing_method", "SCREEN")
    ro = getattr(e, "ray_tracing_options", None)
    if ro is not None:
        S.set(ro, "resolution_scale", cfg["ray_resolution"], "ray.resolution_scale")
        for k in ("use_denoise", "denoise_spatial", "denoise_temporal", "denoise_bilateral"):
            S.set(ro, k, True, "ray." + k)
        S.set(ro, "trace_max_roughness", 0.6, "ray.trace_max_roughness")
        S.set(ro, "screen_trace_quality", 0.5, "ray.screen_trace_quality")
        S.set(ro, "screen_trace_thickness", 0.2, "ray.screen_trace_thickness")
    S.set(e, "use_fast_gi", True)
    S.set(e, "fast_gi_method", "GLOBAL_ILLUMINATION")
    S.set(e, "fast_gi_resolution", cfg["fast_gi_resolution"])
    S.set(e, "fast_gi_ray_count", cfg["fast_gi_rays"])
    S.set(e, "fast_gi_step_count", cfg["fast_gi_steps"])
    S.set(e, "fast_gi_distance", 1.5)
    S.set(e, "use_shadows", True)
    S.set(e, "shadow_ray_count", cfg["shadow_rays"])
    S.set(e, "shadow_step_count", cfg["shadow_steps"])
    S.set(e, "shadow_pool_size", cfg["shadow_pool"])
    S.set(e, "shadow_resolution_scale", 1.0)
    S.set(e, "clamp_surface_indirect", cfg["clamp_indirect"])
    S.set(e, "bokeh_max_size", 200.0)
    S.set(e, "bokeh_threshold", 0.8)
    S.set(e, "bokeh_neighbor_max", 10.0)
    S.set(e, "use_bokeh_jittered", True)
    S.set(e, "bokeh_overblur", 5.0)
    S.set(e, "use_volumetric_shadows", False)
    S.set(sc.render, "filter_size", cfg["filter_size"])
    S.set(sc.render, "use_motion_blur", bool(motion_blur))
    S.set(sc.render, "motion_blur_shutter", cfg["shutter"])
    S.set(sc.render, "motion_blur_position", "CENTER")
    S.set(e, "motion_blur_steps", 1)
    if sc.world is not None:
        S.set(sc.world, "probe_resolution", "512", "world.probe_resolution")
        S.set(sc.world, "sun_threshold", 1000.0, "world.sun_threshold")
    output(sc, W, H, alpha, depth)
    color(sc, look, exposure)
    return S


def eevee_adapt(sc):
    """Map Cycles-only constructs onto EEVEE (trimmed to what the pack builds): ray
    visibility on lights -> diffuse/specular factors; soft jittered shadows on the big emitters; glass -> raytraced
    refraction + slab thickness + dithered."""
    for ob in sc.objects:
        if ob.type != "LIGHT":
            continue
        L = ob.data
        if not ob.visible_diffuse:
            L.diffuse_factor = 0.0
        if not ob.visible_glossy:
            L.specular_factor = 0.0
        for k, v in (("use_shadow", True), ("use_shadow_jitter", L.type in ("AREA", "SPOT", "SUN") and L.energy > 8.0),
                     ("shadow_jitter_overblur", 10.0), ("shadow_filter_radius", 1.5)):
            if hasattr(L, k):
                setattr(L, k, v)


def gpu_devices(kind="METAL"):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    names = []
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == kind
            if d.use:
                names.append(d.name)
    except (TypeError, ValueError):
        pass
    return names


def cycles_keyart(sc, W, H, samples=None, threshold=0.006, seed=7, alpha=False, look=LOOK, exposure=0.0, device="GPU",
                  denoise=True, denoise_gpu=False, depth="8", motion_blur=False):
    S = Settings()
    sc.render.engine = "CYCLES"
    c = sc.cycles
    devs = gpu_devices("METAL") if device == "GPU" else []
    S.set(c, "device", "GPU" if devs else "CPU")
    S.set(c, "samples", int(samples or 1024))
    S.set(c, "use_adaptive_sampling", True)
    S.set(c, "adaptive_threshold", threshold)
    S.set(c, "adaptive_min_samples", 32)
    S.set(c, "time_limit", 0.0)
    S.set(c, "use_denoising", bool(denoise))
    if denoise:
        S.set(c, "denoiser", "OPENIMAGEDENOISE")
        S.set(c, "denoising_input_passes", "RGB_ALBEDO_NORMAL")
        S.set(c, "denoising_prefilter", "ACCURATE")
        S.set(c, "denoising_quality", "HIGH")
        S.set(c, "denoising_use_gpu", bool(denoise_gpu))
    for k, v in (("max_bounces", 10), ("diffuse_bounces", 4), ("glossy_bounces", 6), ("transmission_bounces", 12),
                 ("transparent_max_bounces", 16), ("volume_bounces", 1), ("caustics_reflective", False),
                 ("caustics_refractive", False), ("blur_glossy", 0.15), ("sample_clamp_direct", 0.0),
                 ("sample_clamp_indirect", 15.0), ("use_light_tree", True), ("filter_width", 1.0), ("seed", int(seed)),
                 ("use_animated_seed", False)):
        S.set(c, k, v)
    S.set(sc.render, "use_persistent_data", True)
    S.set(sc.render, "use_motion_blur", bool(motion_blur))
    S.set(sc.render, "motion_blur_shutter", PLATE["shutter"])
    output(sc, W, H, alpha, depth, compression=15)
    color(sc, look, exposure)
    S.applied["devices"] = ", ".join(devs) if devs else "CPU"
    return S


def describe_device(engine):
    if engine == "cycles":
        return "Cycles " + bpy.context.scene.cycles.device + ": " + (", ".join(gpu_devices("METAL")) or "CPU")
    return "EEVEE (GPU, Metal backend)"
