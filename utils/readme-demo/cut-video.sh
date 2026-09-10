#!/usr/bin/env bash
# Edits a hand-recorded screen capture into the README GIF: keeps the listed
# source segments, concatenates them, speeds playback up, and writes an
# optimized GIF to documentation/img/linshare-quick-share.gif.
#
# Usage: bash cut-video.sh <input.mp4>
# Env:   SEGS="start:end start:end ..." (source seconds)  W=960 FPS=12 SPEED=1.4 LOSSY=60
set -euo pipefail
cd "$(dirname "$0")"
IN=${1:?usage: cut-video.sh <input.mp4>}
OUT=../../documentation/img/linshare-quick-share.gif
W=${W:-960}; FPS=${FPS:-12}; SPEED=${SPEED:-1.4}; LOSSY=${LOSSY:-60}
FF=$(node -p "require('ffmpeg-static')"); GS=$(node -p "require('gifsicle').default")
# Segments used for the current README GIF (recorded 2026-09-10, 86 s source):
# sign-in, dashboard, My Space upload menu, upload + thumbnails, select + Share,
# composer through Send, success toast, protected share page, recipient's file list.
SEGS="${SEGS:-0.0:0.9 5.0:7.5 10.0:11.9 19.0:27.0 27.5:31.0 31.0:50.5 50.5:52.0 66.2:69.5 71.0:76.5}"
F=""; C=""; i=0; total=0
for s in $SEGS; do a=${s%%:*}; b=${s##*:}; F+="[0:v]trim=start=$a:end=$b,setpts=PTS-STARTPTS[s$i];"; C+="[s$i]"; total=$(node -p "$total+($b-$a)"); i=$((i+1)); done
F+="${C}concat=n=$i:v=1:a=0,setpts=PTS/$SPEED,fps=$FPS,scale=$W:-1:flags=lanczos"
echo "kept ${total}s of source -> ~$(node -p "($total/$SPEED).toFixed(1)")s at ${SPEED}x, $i segments"
$FF -hide_banner -loglevel error -i "$IN" -filter_complex "$F,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 -y raw.gif
$GS -O3 --lossy="$LOSSY" --colors 256 raw.gif -o "$OUT"
rm -f raw.gif
ls -la "$OUT" | awk '{printf "%s %.2f MB\n",$9,$5/1048576}'
