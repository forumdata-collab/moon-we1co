# 賞月 · 3D Moon（moon.we1co.me）

中秋特企：three.js 高清互動月球，真實月相（astronomy-engine 計算香港月出/月落/滿月時刻），NASA LRO/LOLA 材質。

## 功能
- 3D 月球：頂點位移地形 + 法線貼圖 + 真實月相光照（光源＝太陽實際方向）
- 月相資訊：光照百分比、月出/月落、最近滿月時刻、距滿月倒數
- 月面標籤：懸停顯示 30 個月海/環形山中英名稱（raycast + 經緯度查表）
- 滿月視角一鍵跳轉；OrbitControls 旋轉/縮放/阻尼
- 繁中 / English

## 技術
- 純靜態 + three.js（vendored，無 CDN 依賴）、astronomy-engine（vendored）
- 貼圖存 Cloudflare R2（bucket `moon-textures`），Pages Function `/tex/*` 代理（同 tarot 套路）
- 材質：NASA SVS CGI Moon Kit（lroc_color_poles 4K + ldem_16 DEM）→ 處理成 color 4K/2K JPG、height 2K PNG、Sobel normal 2K JPG（`process_tex.py`）
- LOD：手機/弱網自動用 2K 色圖

## 授權
- 月球材質：NASA/Goddard SVS，資料 LRO LOLA（公有領域）
- three.js / astronomy-engine（MIT）

## 部署
```bash
wrangler pages deploy . --project-name=moon-we1co --branch=main
# R2 binding: MOON_TEX → moon-textures
```