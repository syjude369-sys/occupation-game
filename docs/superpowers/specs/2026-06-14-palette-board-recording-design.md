# Base GameBoard Palette and Recording Design

## Goal

Apply the approved thin technical-drawing palette and export the board simulation as a video.

## Visual System

- True white board and drawing surfaces.
- Near-black technical lines.
- Cyan `#00A9F4`, hot pink `#FF6192`, and pale lilac `#F5DFF5` as the primary accents.
- Grid lines remain visually light; major frames use only slightly heavier strokes.
- Player colors stay saturated and distinct against the monochrome board.

## Defaults

- Grid count: `17`.
- Module width: grid span multiplied by `2`.

## Recording

- Record only the board, excluding the controls and inspector.
- Composite the SVG board onto a fixed-resolution canvas.
- Add a compact information bar below the board showing turn, player count, grid, cell span, module multiplier, movement probabilities, attack probability, door hold, and playback speed.
- Recording starts at turn 0, runs the simulation automatically, and stops at the configured final turn.
- Export through `MediaRecorder` as a downloadable WebM file.
- Keep the most recent recording available through a separate download button.

## Error Handling

- Disable recording controls when the browser lacks Canvas capture or MediaRecorder support.
- Prevent concurrent recordings.
- Stop and retain the partial recording if the user presses Stop.
- Show recording state and elapsed time in the board status bar.

## Verification

- Automated tests cover defaults, recording metadata text, file naming, and MIME selection.
- Browser checks cover visual palette, playback, recording state, automatic stop, and downloadable output.

