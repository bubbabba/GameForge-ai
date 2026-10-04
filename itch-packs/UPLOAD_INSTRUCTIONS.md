# Instructions for Claude (local session with Claude in Chrome)

The owner (itch.io account **bubbabba**) wants these asset packs uploaded to their itch page.
Use Claude in Chrome. The owner is already logged in to itch.io in Chrome.
All files are in this folder (`itch-packs/`) on the `itch-asset-packs` branch of `bubbabba/GameForge-ai`.

## 0. Before uploading anything
1. Open https://itch.io/dashboard and list every existing project.
2. **Do not create duplicates.** If a top-down modern town/city exteriors pack or a top-down interiors/furniture
   pack already exists, stop and ask the owner before going on.
3. Earlier request, still open: the **side scroller asset pack** should show on the bubbabba profile the way the
   **Godot starter kit** does. Open that project → Edit → bottom of the page → **Visibility & access**.
   If it says Draft or Restricted, tell the owner and set it to **Public** once they confirm.

## 1. For each pack (Exteriors first, then Interiors)
All text, prices, tags and file paths are in `ITCH_PAGES.md`.
1. Dashboard → **Create new project**.
2. Fill in the Title, Project URL and Short description (tagline).
3. Classification: **Assets**. Kind of project: **Downloadable**.
4. Pricing: **Paid**, at the suggested price ("let people pay more" is fine).
5. Uploads: upload the `.zip` from `dist/`. Leave the platform boxes unticked (it's an asset pack).
6. Description: paste the description block.
7. Tags: add the listed tags.
8. Cover image: `cover_630x500.png`. Screenshots: the other images in the matching `*_itch_page/` folder.
9. Visibility: save as **Draft** first. Show the owner the preview link, and only switch to **Public** after
   they approve.

## 2. After both are Public
- Optionally create the bundle described in `ITCH_PAGES.md` §3.
- Report back to the owner with both project URLs.

## Rebuilding / changing the art
The packs are generated procedurally:
`pip install pillow numpy && python3 generator/build.py` rebuilds `dist/` (seeded, so the output is identical).
