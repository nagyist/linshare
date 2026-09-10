# README demo recording

Tooling for `documentation/img/linshare-quick-share.gif`, the animated
walkthrough shown in the top-level README. Two ways to produce it:

## A. Edit a hand-recorded screen capture (current GIF)

Record the user portal with any screen recorder (the current GIF comes
from an 86 s capture: sign in, upload files, share, then open the
protected share as the recipient), then cut it down:

```bash
cd utils/readme-demo
npm install
bash cut-video.sh /path/to/capture.mp4
```

`SEGS` in the script lists the source segments to keep (seconds); adjust
it for a new recording. Cut out OS dialogs, browser prompts and idle
time, and aim for about 30 s.

## B. Record automatically with Playwright

`record.js` drives a real LinShare user portal, records the session and
`convert.sh` turns it into a GIF (sign in, drop a file into Quick Share,
pick a recipient, send). The run uploads one small PDF and shares it with
the recipient, so point it at a test or demo instance.

```bash
cd utils/readme-demo
npm install
npx playwright install chromium

LINSHARE_URL=https://user.example.org/new/login \
LINSHARE_USER=abbey.curry@linshare.org \
LINSHARE_PASSWORD=secret \
LINSHARE_RECIPIENT=amy \
LINSHARE_RECIPIENT_LABEL='Amy WOLSH' \
npm run gif
```

`record.js` writes the WebM under `video/` plus `marks.json` (step
timestamps). `convert.sh` trims the video, speeds it up 1.3x, and writes
the optimized GIF into `documentation/img/`. Arguments, all optional:
`bash convert.sh <width> <fps> <gifsicle-lossy> <speed> <webp 0|1>`.
