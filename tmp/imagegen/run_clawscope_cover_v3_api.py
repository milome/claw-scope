import base64
import json
import os
import socket
import ssl
import time
from pathlib import Path
from urllib import error, request


API_KEY_NAME = "OPENAI-GPT-IMAGE-2-API-KEY"
API_URL = "https://ai-api-cn.db-kj.com/v1/images/generations"
ROOT = Path(__file__).resolve().parents[2]
RUN_DIR = ROOT / "tmp" / "imagegen" / "clawscope-cover-v3-api-run"
PROMPT_PATH = ROOT / "tmp" / "imagegen" / "clawscope-cover-bg-v3-prompt.txt"
ICON_PATH = ROOT / "icon-source.png"
OUT_PATH = ROOT / "public" / "images" / "covers" / "clawscope-cover-bg-v3.png"


def write_json(name, data):
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    path = RUN_DIR / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def now_ms():
    return int(time.time() * 1000)


def read_api_key():
    value = os.environ.get(API_KEY_NAME)
    if value:
        return value
    if os.name == "nt":
        import subprocess

        cmd = [
            "powershell",
            "-NoProfile",
            "-Command",
            f"[Environment]::GetEnvironmentVariable('{API_KEY_NAME}', 'User')",
        ]
        result = subprocess.run(cmd, check=False, capture_output=True, text=True)
        value = result.stdout.strip()
        if value:
            return value
    return None


def main():
    started = now_ms()
    api_key = read_api_key()
    if not api_key:
        write_json(
            "error.json",
            {
                "stage": "read_api_key",
                "message": f"{API_KEY_NAME} is missing",
                "elapsed_ms": now_ms() - started,
            },
        )
        raise SystemExit(2)

    prompt = PROMPT_PATH.read_text(encoding="utf-8")
    image_bytes = ICON_PATH.read_bytes()
    image_data_url = "data:image/png;base64," + base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "size": "3840x2160",
        "quality": "high",
        "n": 1,
        "output_format": "png",
        "images": [{"image_url": image_data_url}],
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    write_json(
        "request-started.json",
        {
            "stage": "request_started",
            "url": API_URL,
            "method": "POST",
            "model": payload["model"],
            "size": payload["size"],
            "quality": payload["quality"],
            "output_format": payload["output_format"],
            "n": payload["n"],
            "has_api_key": True,
            "input_image": str(ICON_PATH),
            "input_image_bytes": len(image_bytes),
            "prompt_path": str(PROMPT_PATH),
            "prompt_chars": len(prompt),
            "body_bytes": len(body),
            "started_ms": started,
        },
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    req = request.Request(API_URL, data=body, headers=headers, method="POST")
    request_started = time.time()

    try:
        with request.urlopen(req, timeout=1200) as resp:
            raw = resp.read()
            elapsed_ms = int((time.time() - request_started) * 1000)
            write_json(
                "response-status.json",
                {
                    "stage": "response_received",
                    "http_status": resp.status,
                    "headers": dict(resp.headers.items()),
                    "response_bytes": len(raw),
                    "elapsed_ms": elapsed_ms,
                },
            )
    except error.HTTPError as exc:
        raw = exc.read()
        decoded = raw.decode("utf-8", errors="replace")
        elapsed_ms = int((time.time() - request_started) * 1000)
        write_json(
            "response-status.json",
            {
                "stage": "http_error",
                "http_status": exc.code,
                "headers": dict(exc.headers.items()) if exc.headers else {},
                "response_bytes": len(raw),
                "elapsed_ms": elapsed_ms,
            },
        )
        write_json(
            "error.json",
            {
                "stage": "http_error",
                "http_status": exc.code,
                "body": decoded,
                "elapsed_ms": elapsed_ms,
            },
        )
        raise SystemExit(3)
    except (TimeoutError, socket.timeout, ssl.SSLError, OSError) as exc:
        elapsed_ms = int((time.time() - request_started) * 1000)
        write_json(
            "error.json",
            {
                "stage": "transport_error",
                "error_type": type(exc).__name__,
                "message": str(exc),
                "elapsed_ms": elapsed_ms,
            },
        )
        raise SystemExit(4)

    decoded = raw.decode("utf-8", errors="replace")
    try:
        result = json.loads(decoded)
    except json.JSONDecodeError:
        (RUN_DIR / "response.raw").write_bytes(raw)
        write_json(
            "error.json",
            {
                "stage": "parse_response_json",
                "message": "Response is not valid JSON",
                "response_preview": decoded[:2000],
            },
        )
        raise SystemExit(5)

    image_b64 = None
    image_url = None
    data = result.get("data") if isinstance(result, dict) else None
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            image_b64 = first.get("b64_json") or first.get("image") or first.get("base64")
            image_url = first.get("url")
    if isinstance(result, dict):
        image_b64 = image_b64 or result.get("b64_json") or result.get("image") or result.get("base64")
        image_url = image_url or result.get("url")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if image_b64:
        if image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        OUT_PATH.write_bytes(base64.b64decode(image_b64))
    elif image_url:
        img_req = request.Request(image_url, headers={"User-Agent": "clawscope-imagegen"})
        with request.urlopen(img_req, timeout=300) as img_resp:
            OUT_PATH.write_bytes(img_resp.read())
    else:
        write_json("response.json", result)
        write_json(
            "error.json",
            {
                "stage": "extract_image",
                "message": "No image field found in successful response",
                "response_path": str(RUN_DIR / "response.json"),
            },
        )
        raise SystemExit(6)

    write_json(
        "output.json",
        {
            "stage": "output_saved",
            "output": str(OUT_PATH),
            "output_bytes": OUT_PATH.stat().st_size,
            "total_elapsed_ms": now_ms() - started,
        },
    )
    print(str(OUT_PATH))


if __name__ == "__main__":
    main()
