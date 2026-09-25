#!/usr/bin/env python3
"""Process NASA moon textures: color JPG (4K/2K), height PNG (2K), Sobel normal (2K); upload to R2."""
import json, os, io
import numpy as np
from PIL import Image
import boto3
from botocore.config import Config

SRC = "/tmp/moontex"
BUCKET = "moon-textures"

# ---- color ----
color4 = Image.open(os.path.join(SRC, "lroc_color_poles_4k.tif")).convert("RGB")
print("color4 size:", color4.size)
buf = io.BytesIO(); color4.save(buf, "JPEG", quality=88, optimize=True)
color4_jpg = buf.getvalue()
buf2 = io.BytesIO()
color2 = color4.resize((2048, 1024), Image.LANCZOS)
color2.save(buf2, "JPEG", quality=86, optimize=True)
color2_jpg = buf2.getvalue()
print(f"color4 {len(color4_jpg)//1024}KB | color2 {len(color2_jpg)//1024}KB")

# ---- height (uint16 TIFF, km) ----
h = Image.open(os.path.join(SRC, "ldem_16_uint.tif"))
print("height src size:", h.size, h.mode)
h = h.convert("I;16") if h.mode not in ("I;16",) else h
h = h.resize((2048, 1024), Image.LANCZOS)
arr = np.asarray(h, dtype=np.float64)
lo, hi = np.nanpercentile(arr, 1), np.nanpercentile(arr, 99)
print(f"height range: {lo:.0f}..{hi:.0f}")
norm = np.clip((arr - lo) / (hi - lo), 0, 1)
img8 = Image.fromarray((norm * 255).astype(np.uint8), "L")
bufh = io.BytesIO(); img8.save(bufh, "PNG", optimize=True)
height_png = bufh.getvalue()
print(f"height_2k {len(height_png)//1024}KB")

# ---- normal from height (tangent-space, y-up: n = (-dH/dx, -dH/dy, 1) normalized) ----
H = norm.astype(np.float32)
gx = np.gradient(H, axis=1)   # d/dx (horizontal, longitude)
gy = np.gradient(H, axis=0)   # d/dy (vertical, latitude)  - image row down = south
# strength scale
s = 3.0
nx = np.clip(-gx * s, -1, 1)
ny = np.clip(gy * s, -1, 1)   # y-up: image top = north, gradient down = -y
nz = np.ones_like(nx)
nlen = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
normal = np.stack([nx / nlen, ny / nlen, nz / nlen], axis=-1)
rgb = ((normal * 0.5 + 0.5) * 255).astype(np.uint8)
imgN = Image.fromarray(rgb, "RGB")
bufN = io.BytesIO(); imgN.save(bufN, "JPEG", quality=88, optimize=True)
normal_jpg = bufN.getvalue()
print(f"normal_2k {len(normal_jpg)//1024}KB")

# ---- upload R2 ----
env = {}
for line in open("/home/ubuntu/.hermes/.env"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
s3 = boto3.client("s3", endpoint_url=f"https://{env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                  aws_access_key_id=env["R2_ACCESS_KEY_ID"], aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
                  region_name="auto", config=Config(signature_version="s3v4"))
try:
    s3.create_bucket(Bucket=BUCKET)
    print("bucket created")
except Exception as e:
    print("bucket:", e)
items = {"color_4k.jpg": color4_jpg, "color_2k.jpg": color2_jpg, "height_2k.png": height_png, "normal_2k.jpg": normal_jpg}
for k, v in items.items():
    ct = "image/jpeg" if k.endswith("jpg") else "image/png"
    s3.put_object(Bucket=BUCKET, Key=k, Body=v, ContentType=ct)
    print("uploaded", k, len(v) // 1024, "KB")
res = s3.list_objects_v2(Bucket=BUCKET)
print("objects:", [o["Key"] for o in res.get("Contents", [])])
