#!/usr/bin/env python3
"""Photographic-grade moon textures: 8K/4K/2K color (high-contrast monochrome-ish), 4K normal; upload R2."""
import io, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import boto3
from botocore.config import Config

SRC = "/tmp/moontex"
BUCKET = "moon-textures"

def photo_grade(img):
    """Photo look: desaturate ~50%, lift contrast, unsharp-mask sharpen, mild tone curve."""
    img = img.convert("L").convert("RGB")          # monochrome base (like a B&W moon photo)
    img = ImageEnhance.Contrast(img).enhance(1.28)  # higher contrast
    img = ImageEnhance.Brightness(img).enhance(1.04)
    # unsharp mask sharpen
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=140, threshold=2))
    # gentle S-curve via point map on luminance
    a = np.asarray(img, dtype=np.float32) / 255.0
    a = np.clip(1.25 * a - 0.125, 0, 1)            # lift mids, deepen shadows
    a = np.clip((a - 0.5) * 1.18 + 0.5, 0, 1)
    img = Image.fromarray((a * 255).astype(np.uint8))
    return img

def save_jpg(img, q):
    b = io.BytesIO(); img.save(b, "JPEG", quality=q, optimize=True); return b.getvalue()

print("loading 8K tif...")
src8 = Image.open(os.path.join(SRC, "lroc_color_poles_8k.tif")).convert("L").convert("RGB")
print("8K size:", src8.size)
g8 = photo_grade(src8)
c8 = save_jpg(g8, 85)
print(f"color_8k: {len(c8)//1024}KB")

g4 = g8.resize((4096, 2048), Image.LANCZOS)
c4 = save_jpg(g4, 88)
print(f"color_4k: {len(c4)//1024}KB")

g2 = g8.resize((2048, 1024), Image.LANCZOS)
c2 = save_jpg(g2, 86)
print(f"color_2k: {len(c2)//1024}KB")

# normal 4K from 8K monochrome (gradient of the graded image)
arr = np.asarray(g8.resize((4096, 2048), Image.LANCZOS).convert("L"), dtype=np.float32) / 255.0
s = 3.2
gx = np.gradient(arr, axis=1); gy = np.gradient(arr, axis=0)
nx = np.clip(-gx * s, -1, 1); ny = np.clip(gy * s, -1, 1); nz = np.ones_like(nx)
nl = np.sqrt(nx**2 + ny**2 + nz**2)
normal = ((np.stack([nx/nl, ny/nl, nz/nl], -1) * 0.5 + 0.5) * 255).astype(np.uint8)
n4 = save_jpg(Image.fromarray(normal, "RGB"), 88)
print(f"normal_4k: {len(n4)//1024}KB")

env = {}
for line in open("/home/ubuntu/.hermes/.env"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k] = v
s3 = boto3.client("s3", endpoint_url=f"https://{env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                  aws_access_key_id=env["R2_ACCESS_KEY_ID"], aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
                  region_name="auto", config=Config(signature_version="s3v4"))
items = {"color_8k.jpg": c8, "color_4k.jpg": c4, "color_2k.jpg": c2, "normal_4k.jpg": n4}
for k, v in items.items():
    s3.put_object(Bucket=BUCKET, Key=k, Body=v, ContentType="image/jpeg")
    print("uploaded", k, len(v)//1024, "KB")
print("objects:", [o["Key"] for o in s3.list_objects_v2(Bucket=BUCKET).get("Contents", [])])
