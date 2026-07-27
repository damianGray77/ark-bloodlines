# ARK Bloodlines Scanner release checklist

## Content cleanup

- Import `assets/branding/HUD_ArkBloodlinesScanner_Icon.png` into the mod root as `HUD_ArkBloodlinesScanner_Icon`.
- In the imported texture, set **Texture Group** to `World` and **Mip Gen Settings** to `Sharpen 4`.
- In `Buff_ArkBloodlineScanner > BPGetMultiUseEntries`, assign that texture to the `Icon` pin of the scanner's `Make Multi Use Entry`.
- Keep **Use Old Multi Use Option With Text** disabled. The existing use string can remain as the hover/accessibility label.
- Search `Buff_ArkBloodlineScanner` for `Print String` and remove the temporary `ABL Event BeginPlay`, `ABL export selected`, and HP-stat diagnostic prints. Reconnect any execution wires that passed through a print.
- Set `ModDataAsset_BlankMod > Mod Name` to `ARK Bloodlines Scanner`.
- Compile and save every changed asset.

## Runtime smoke test

- The wheel entry shows the white cracked-egg/DNA icon.
- Selecting the entry opens one export window.
- No scanner debug text appears on screen.
- The close button darkens on hover and closes the window.
- The mouse cursor and game input return after closing.
- `PreviewJson` and `TransferCode` both contain the selected creature.
- Importing the transfer code into ARK Bloodlines succeeds.

## Cloud cook and private installation

1. In the DevKit, choose **UGC > Share Mod**.
2. Select `ArkBloodlinesScanner`.
3. Use the title `ARK Bloodlines Scanner` and paste `CURSEFORGE_DESCRIPTION.md` into the description.
4. Choose **PC-Only** for the first test build unless cross-platform release is already intended.
5. Upload and wait for the Windows and WindowsServer cloud cooks to finish.
6. Open the CurseForge project page and install the unpublished build through ARK's **My Mods** tab.
7. Enable it for a single-player save and repeat the runtime smoke test before publishing.
