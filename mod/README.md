# ARK Bloodlines Scanner mod

This folder contains the complete ASA DevKit plugin used by the ARK Bloodlines companion app.

The scanner adds an action to a tamed creature's radial menu. It reads breeding-relevant creature data and displays an `ABL1:` transfer code for manual copying into the browser app. It does not modify the creature or access the filesystem, network, or clipboard automatically.

## Configuration

The raw JSON preview is hidden by default; the portable `ABL1:` transfer code remains visible. To expose the JSON for troubleshooting, add the following server-wide option to `GameUserSettings.ini` and restart the session:

```ini
[ArkBloodlinesScanner]
ShowDebugJson=True
```

Remove the option or set it to `False` to restore the normal compact window. New creatures receive the scanner action immediately. Legacy creatures saved before the mod was installed are repaired automatically when they are near a connected player, normally within ten seconds.

## Development

The plugin was created with the ARK: Survival Ascended DevKit. To work on it:

1. Install and launch the ASA DevKit.
2. Copy `ArkBloodlinesScanner` into:

   ```text
   <ARK DevKit>/ARKDevKit/Projects/ShooterGame/Mods/
   ```

3. Enable `ArkBloodlinesScanner` from the DevKit's **UGC** menu.
4. Open the assets from the plugin's **Content** folder.

The `.uasset` and `.umap` files are Unreal binary assets. The repository's [`devkit`](../devkit/) directory also contains Blueprint clipboard exports, generators, presentation assets, and the release checklist used while building the plugin.

## Cooking and testing

ASA mods are cooked by CurseForge rather than packaged locally. Use **UGC → Share Mod** in the DevKit, wait for the build to reach `ReadyForReview`, and install the unpublished build from ARK's **My Mods** tab.

Do not copy this source directory directly into the retail ARK installation; the game requires the cloud-cooked build.
