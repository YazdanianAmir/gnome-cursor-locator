import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    DURATION_MS,
    ENABLE_JIGGLE_DETECTION,
    RADIUS,
    SHORTCUT,
} from './constants.ts';

export default class CursorLocatorPrefs extends ExtensionPreferences {
    private settings!: Gio.Settings;
    private shortcutLabel!: Gtk.ShortcutLabel;
    private shortcutRow!: Adw.ActionRow;

    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        this.settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            // title: 'Cursor Locator',
            title: _('Cursor Locator'),
        });

        group.add(this.createShortcutRow(window));
        group.add(this.createDurationRow());
        group.add(this.createRadiusRow());
        group.add(this.createJiggleRow());
        group.add(this.createResetRow());

        page.add(group);
        window.add(page);
    }

    private createShortcutRow(window: Adw.PreferencesWindow): Adw.ActionRow {
        this.shortcutRow = new Adw.ActionRow({
            title: _('Keyboard Shortcut'),
        });

        this.shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: this.getShortcut(),
            valign: Gtk.Align.CENTER,
        });

        const button = new Gtk.Button({
            child: this.shortcutLabel,
            valign: Gtk.Align.CENTER,
        });

        button.connect('clicked', () => {
            this.openShortcutDialog(window);
        });

        this.shortcutRow.add_suffix(button);
        this.shortcutRow.activatable_widget = button;

        this.syncShortcutUi();

        return this.shortcutRow;
    }

    private createDurationRow(): Adw.SpinRow {
        const row = new Adw.SpinRow({
            title: _('Animation Duration'),
            adjustment: new Gtk.Adjustment({
                lower: 200,
                upper: 3000,
                step_increment: 100,
                value: this.settings.get_int(DURATION_MS),
            }),
        });

        this.settings.bind(
            DURATION_MS,
            row,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        return row;
    }

    private createRadiusRow(): Adw.SpinRow {
        const row = new Adw.SpinRow({
            title: _('Spotlight Radius'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 300,
                step_increment: 10,
                value: this.settings.get_int(RADIUS),
            }),
        });

        this.settings.bind(
            RADIUS,
            row,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        return row;
    }

    private createJiggleRow(): Adw.SwitchRow {
        const row = new Adw.SwitchRow({
            title: _('Enable Jiggle Detection'),
            subtitle: _('Automatically show the locator when the mouse is jiggled.'),
        });

        this.settings.bind(
            ENABLE_JIGGLE_DETECTION,
            row,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        return row;
    }

    private createResetRow(): Adw.ActionRow {
        const row = new Adw.ActionRow({
            title: _('Reset Settings'),
            subtitle: _('Restore shortcut, animation duration, spotlight radius, and jiggle detection.'),
        });

        const button = new Gtk.Button({
            label: _('Reset'),
            valign: Gtk.Align.CENTER,
        });

        button.connect('clicked', () => {
            this.resetSettings();
        });

        row.add_suffix(button);
        row.activatable_widget = button;

        return row;
    }

    private openShortcutDialog(window: Adw.PreferencesWindow) {
        const dialog = new Gtk.Dialog({
            title: 'Set Keyboard Shortcut',
            modal: true,
            transient_for: window,
        });

        const label = new Gtk.Label({
            label: _('Press a new shortcut, Backspace to disable, or Escape to cancel.'),
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });

        dialog.get_content_area().append(label);

        const controller = new Gtk.EventControllerKey();

        controller.connect(
            'key-pressed',
            (_controller, keyval, _keycode, state) => {
                if (keyval === Gdk.KEY_Escape) {
                    dialog.close();
                    return true;
                }

                if (keyval === Gdk.KEY_BackSpace) {
                    this.setShortcut('');
                    dialog.close();
                    return true;
                }

                const mask = state & Gtk.accelerator_get_default_mod_mask();

                if (!Gtk.accelerator_valid(keyval, mask))
                    return true;

                this.setShortcut(Gtk.accelerator_name(keyval, mask));

                dialog.close();
                return true;
            }
        );

        dialog.add_controller(controller);
        dialog.present();
    }

    private resetSettings() {
        this.settings.reset(DURATION_MS);
        this.settings.reset(RADIUS);
        this.settings.reset(SHORTCUT);
        this.settings.reset(ENABLE_JIGGLE_DETECTION);

        // Bound rows update automatically. The shortcut uses a custom widget.
        this.syncShortcutUi();
    }

    private getShortcut(): string {
        return this.settings.get_strv(SHORTCUT)[0] ?? '';
    }

    private setShortcut(accelerator: string) {
        this.settings.set_strv(
            SHORTCUT,
            accelerator ? [accelerator] : []
        );

        this.syncShortcutUi();
    }

    private syncShortcutUi() {
        const accelerator = this.getShortcut();

        this.shortcutLabel.accelerator = accelerator;
        this.shortcutRow.subtitle = accelerator || 'Disabled';
    }
}
