"""motion-pack / cloud / _gcp.py : shared config for the optional Google Cloud audio back-ends.

Nothing here is required by the pack. Every value comes from the environment, never from the repo:
  MP_GCP_PROJECT   Google Cloud project with the Vertex AI API enabled and billing on (required)
  MP_GCP_LOCATION  Vertex region (default us-central1)
Auth: Application Default Credentials if present, otherwise `gcloud auth print-access-token`."""
import os
import shutil
import subprocess

SR = 48000


class CloudConfigError(RuntimeError):
    pass


def project():
    p = os.environ.get("MP_GCP_PROJECT", "").strip()
    if not p:
        raise CloudConfigError("set MP_GCP_PROJECT to a Google Cloud project with Vertex AI enabled (billing applies)")
    return p


def location():
    return os.environ.get("MP_GCP_LOCATION", "us-central1").strip() or "us-central1"


def access_token():
    try:
        import google.auth
        import google.auth.transport.requests
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(google.auth.transport.requests.Request())
        if creds.token:
            return creds.token
    except Exception:
        pass
    if shutil.which("gcloud"):
        r = subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    raise CloudConfigError("no Google credentials: run `gcloud auth login` or `gcloud auth application-default login`")


def genai_client():
    try:
        from google import genai
    except ImportError as e:
        raise CloudConfigError("pip install google-genai (optional dependency of motion-pack/cloud)") from e
    return genai.Client(vertexai=True, project=project(), location=location())


def to_wav48(src, dst, channels=2):
    """resample any audio file to the pack's 48 kHz s16 WAV (stereo by default) with ffmpeg"""
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ar", str(SR), "-ac", str(channels), "-c:a", "pcm_s16le", dst],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg failed: " + r.stderr[-400:])
    return dst
