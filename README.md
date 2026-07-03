# Telegraph

Telegraph is a small browser-based Morse code tool. It can encode typed text into Morse, play it as an audio tone, and let you tap a virtual telegraph key to decode manual input.

## Features

- Text-to-Morse encoding with audio playback
- Adjustable playback speed, tone frequency, letter spacing, and dash cutoff
- Manual telegraph key with pointer and spacebar controls
- Live Morse reference for letters and numbers
- No build step or server required

## Run Locally

Open `index.html` in a browser:

```sh
open index.html
```

Because the app uses the Web Audio API, audio starts after a button press or key interaction.

## GitHub Pages

The site is configured for:

```text
https://telegraph.andruwsorensen.com/
```

## Project Structure

```text
.
├── app.js
├── index.html
└── styles.css
```
