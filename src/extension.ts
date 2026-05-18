import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    SHORTCUT
} from './constants.ts';
import { CursorLocatorOverlay } from './locatorOverlay.ts';

export default class CursorLocatorExtension extends Extension {
    private settings: Gio.Settings | null = null;
    private locator: CursorLocatorOverlay | null = null;

    enable() {
        this.settings = this.getSettings();
        this.locator = new CursorLocatorOverlay(this.settings);

        this.bindShortcut();
        this.locator.startJiggleDetection();
    }

    disable() {
        this.unbindShortcut();

        this.locator?.destroy();
        this.locator = null;

        this.settings = null;
    }

    private unbindShortcut() {
        Main.wm.removeKeybinding(SHORTCUT);
    }

    private bindShortcut() {
        if (!this.settings || !this.locator)
            return;

        Main.wm.addKeybinding(
            SHORTCUT,
            this.settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this.locator?.show()
        );
    }
}
