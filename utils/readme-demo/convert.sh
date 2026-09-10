#!/usr/bin/env bash
# Turns the WebM recorded by record.js into the README GIF.
# Usage: bash convert.sh [width] [fps] [gifsicle-lossy] [speed] [webp 0|1]
set -euo pipefail
cd "$(dirname "$0")"
W=${1:-960}; FPS=${2:-12}; LOSSY=${3:-60}; SPEED=${4:-1.3}; WEBP=${5:-0}
OUT=../../documentation/img/linshare-quick-share
FF=$(node -p "require('ffmpeg-static')"); GS=$(node -p "require('gifsicle').default")
M=./marks.json
V=$(node -p "require('$M').path")
# Skip the blank page shown while the dashboard reloads after sign-in.
START=$(node -p "Math.max(0,(require('$M').loginReady-300)/1000)")
CUT1=$(node -p "(require('$M').loginSubmitted+500)/1000")
CUT2=$(node -p "(require('$M').dashboard-100)/1000")
END=$(node -p "require('$M').end/1000")
FILTER="[0:v]trim=start=$START:end=$CUT1,setpts=PTS-STARTPTS[s1];[0:v]trim=start=$CUT2:end=$END,setpts=PTS-STARTPTS[s2];[s1][s2]concat=n=2:v=1:a=0,setpts=PTS/$SPEED,fps=$FPS,scale=$W:-1:flags=lanczos"
echo "segments: ${START}s-${CUT1}s + ${CUT2}s-${END}s  width=$W fps=$FPS speed=${SPEED}x"
$FF -hide_banner -loglevel error -i "$V" \
  -filter_complex "$FILTER,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 -y raw.gif
$GS -O3 --lossy="$LOSSY" --colors 256 raw.gif -o "$OUT.gif"
rm -f raw.gif
if [ "$WEBP" = 1 ]; then
  $FF -hide_banner -loglevel error -i "$V" -filter_complex "$FILTER" \
    -c:v libwebp_anim -lossless 0 -q:v 70 -compression_level 6 -loop 0 -y "$OUT.webp"
fi
ls -la "$OUT".* | awk '{printf "%-60s %6.2f MB\n",$9,$5/1048576}'
