import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    ENABLE_JIGGLE_DETECTION,
    SHORTCUT,
} from './constants.ts';
import { CursorLocatorOverlay } from './locatorOverlay.ts';

export default class CursorLocatorExtension extends Extension {
    private settings: Gio.Settings | null = null;
    private locator: CursorLocatorOverlay | null = null;
    private jiggleChangedId = 0;
    private shortcutChangedId = 0;
    private shortcutBound = false;

    enable() {
        this.settings = this.getSettings();
        this.locator = new CursorLocatorOverlay(this.settings);

        this.bindShortcut();
        this.watchShortcutSetting();
        this.watchJiggleSetting();
        this.syncJiggleDetection();
    }

    disable() {
        this.unwatchShortcutSetting();
        this.unbindShortcut();
        this.unwatchJiggleSetting();

        this.locator?.destroy();
        this.locator = null;

        this.settings = null;
    }

    private watchShortcutSetting() {
        if (!this.settings || this.shortcutChangedId)
            return;

        this.shortcutChangedId = this.settings.connect(
            `changed::${SHORTCUT}`,
            () => this.rebindShortcut()
        );
    }

    private unwatchShortcutSetting() {
        if (!this.settings || !this.shortcutChangedId)
            return;

        this.settings.disconnect(this.shortcutChangedId);
        this.shortcutChangedId = 0;
    }

    private rebindShortcut() {
        this.unbindShortcut();
        this.bindShortcut();
    }

    private unbindShortcut() {
        if (!this.shortcutBound)
            return;

        Main.wm.removeKeybinding(SHORTCUT);
        this.shortcutBound = false;
    }

    private watchJiggleSetting() {
        if (!this.settings || this.jiggleChangedId)
            return;

        this.jiggleChangedId = this.settings.connect(
            `changed::${ENABLE_JIGGLE_DETECTION}`,
            () => this.syncJiggleDetection()
        );
    }

    private unwatchJiggleSetting() {
        if (!this.settings || !this.jiggleChangedId)
            return;

        this.settings.disconnect(this.jiggleChangedId);
        this.jiggleChangedId = 0;
    }

    private syncJiggleDetection() {
        if (!this.settings || !this.locator)
            return;

        if (this.settings.get_boolean(ENABLE_JIGGLE_DETECTION))
            this.locator.startJiggleDetection();
        else
            this.locator.stopJiggleDetection();
    }

    private bindShortcut() {
        if (!this.settings || !this.locator)
            return;

        this.unbindShortcut();

        Main.wm.addKeybinding(
            SHORTCUT,
            this.settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this.locator?.show()
        );

        this.shortcutBound = true;
    }
}
