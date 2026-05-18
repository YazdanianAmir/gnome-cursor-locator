import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    DEFAULT_DURATION,
    DEFAULT_OPACITY,
    DEFAULT_RADIUS,
    DURATION_MS,
    ENABLE_JIGGLE_DETECTION,
    RADIUS
} from './constants.ts';

const INTRO_POLL_INTERVAL_MS = 16;
const SETTLED_POLL_INTERVAL_MS = 16;
const FADE_OUT_DURATION_MS = 220;
const MIN_DURATION_MS = 200;

const JIGGLE_POLL_INTERVAL_MS = 33;
const JIGGLE_MIN_STEP_DISTANCE = 10;
const JIGGLE_DIRECTION_CHANGES = 7;
const JIGGLE_MIN_DISTANCE = 520;
const JIGGLE_WINDOW_MS = 950;
const JIGGLE_COOLDOWN_US = 2_000_000;

export class CursorLocatorOverlay {
    private settings: Gio.Settings;

    private overlay: St.Widget | null = null;
    private area: St.DrawingArea | null = null;

    private introTimeoutId = 0;
    private pointerPollId = 0;
    private jigglePollId = 0;

    private fadeOutStarted = false;
    private progress = 0;

    private cursorX = 0;
    private cursorY = 0;

    private repaintQueued = false;

    private dimOpacity = DEFAULT_OPACITY;
    private baseRadius = DEFAULT_RADIUS;
    private durationMs = DEFAULT_DURATION;

    private lastPointerX = 0;
    private lastPointerY = 0;
    private lastDirectionX = 0;
    private directionChanges = 0;
    private movementDistance = 0;
    private jiggleWindowStart = 0;
    private jiggleCooldownUntil = 0;

    constructor(settings: Gio.Settings) {
        this.settings = settings;
    }

    show() {
        if (this.isVisible())
            return;

        this.cacheSettings();

        [this.cursorX, this.cursorY] = global.get_pointer();

        this.progress = 0;
        this.repaintQueued = false;
        this.fadeOutStarted = false;

        const width = global.stage.width;
        const height = global.stage.height;

        this.overlay = new St.Widget({
            reactive: true,
            can_focus: true,
            visible: true,
            x: 0,
            y: 0,
            width,
            height,
            opacity: 255,
        });

        this.area = new St.DrawingArea({
            reactive: false,
            visible: true,
            x: 0,
            y: 0,
            width,
            height,
        });

        this.area.connect('repaint', area => {
            this.draw(area);
        });

        this.overlay.connect('key-press-event', () => {
            this.fadeOutAndDestroy();
            return Clutter.EVENT_STOP;
        });

        this.overlay.connect('button-press-event', () => {
            this.fadeOutAndDestroy();
            return Clutter.EVENT_STOP;
        });

        this.overlay.add_child(this.area);

        Main.layoutManager.uiGroup.add_child(this.overlay);
        Main.layoutManager.uiGroup.set_child_above_sibling(this.overlay, null);

        global.stage.set_key_focus(this.overlay);

        this.area.queue_repaint();

        this.startPointerPolling(INTRO_POLL_INTERVAL_MS);
        this.animateIn();
    }

    isVisible(): boolean {
        return this.overlay !== null;
    }

    startJiggleDetection() {
        if (!this.settings.get_boolean(ENABLE_JIGGLE_DETECTION))
            return;

        if (this.jigglePollId)
            return;

        [this.lastPointerX, this.lastPointerY] = global.get_pointer();

        this.resetJiggleWindow(GLib.get_monotonic_time());

        this.jigglePollId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            JIGGLE_POLL_INTERVAL_MS,
            () => {
                this.checkJiggle();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    stopJiggleDetection() {
        if (!this.jigglePollId)
            return;

        GLib.Source.remove(this.jigglePollId);
        this.jigglePollId = 0;
    }

    private cacheSettings() {
        this.baseRadius = this.settings.get_int(RADIUS);
        this.durationMs = Math.max(
            this.settings.get_int(DURATION_MS),
            MIN_DURATION_MS
        );
    }

    private animateIn() {
        const start = GLib.get_monotonic_time();

        this.introTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            INTRO_POLL_INTERVAL_MS,
            () => {
                const elapsedMs =
                    (GLib.get_monotonic_time() - start) / 1000;

                this.progress = Math.min(elapsedMs / this.durationMs, 1);

                this.area?.queue_repaint();

                if (this.progress >= 1) {
                    this.progress = 1;
                    this.introTimeoutId = 0;

                    this.startPointerPolling(SETTLED_POLL_INTERVAL_MS);
                    this.area?.queue_repaint();

                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    private startPointerPolling(intervalMs: number) {
        this.stopPointerPolling();

        this.pointerPollId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            intervalMs,
            () => {
                const [x, y] = global.get_pointer();

                if (x === this.cursorX && y === this.cursorY)
                    return GLib.SOURCE_CONTINUE;

                this.cursorX = Math.round(x);
                this.cursorY = Math.round(y);

                this.queueSpotlightRepaint();

                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    private stopPointerPolling() {
        if (!this.pointerPollId)
            return;

        GLib.Source.remove(this.pointerPollId);
        this.pointerPollId = 0;
    }

    private stopIntroAnimation() {
        if (!this.introTimeoutId)
            return;

        GLib.Source.remove(this.introTimeoutId);
        this.introTimeoutId = 0;
    }

    private queueSpotlightRepaint() {
        if (this.repaintQueued)
            return;

        this.repaintQueued = true;

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.repaintQueued = false;
            this.area?.queue_repaint();
            return GLib.SOURCE_REMOVE;
        });
    }

    private checkJiggle() {
        const now = GLib.get_monotonic_time();

        if (now < this.jiggleCooldownUntil)
            return;

        if (this.isVisible()) {
            this.resetJiggleWindow(now);
            return;
        }

        const [x, y] = global.get_pointer();

        const dx = x - this.lastPointerX;
        const dy = y - this.lastPointerY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        this.lastPointerX = x;
        this.lastPointerY = y;

        if (distance < JIGGLE_MIN_STEP_DISTANCE)
            return;

        const directionX = Math.sign(dx);

        if (
            directionX !== 0 &&
            this.lastDirectionX !== 0 &&
            directionX !== this.lastDirectionX
        ) {
            this.directionChanges++;
        }

        if (directionX !== 0)
            this.lastDirectionX = directionX;

        this.movementDistance += distance;

        const elapsedMs = (now - this.jiggleWindowStart) / 1000;

        if (elapsedMs > JIGGLE_WINDOW_MS) {
            this.resetJiggleWindow(now);
            return;
        }

        if (
            this.directionChanges >= JIGGLE_DIRECTION_CHANGES &&
            this.movementDistance >= JIGGLE_MIN_DISTANCE
        ) {
            this.show();

            this.resetJiggleWindow(now);
            this.jiggleCooldownUntil = now + JIGGLE_COOLDOWN_US;
        }
    }

    private resetJiggleWindow(now: number) {
        this.directionChanges = 0;
        this.movementDistance = 0;
        this.lastDirectionX = 0;
        this.jiggleWindowStart = now;
    }

    private draw(area: St.DrawingArea) {
        const cr = area.get_context();

        cr.save();

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.rectangle(0, 0, area.width, area.height);
        cr.fill();

        cr.restore();

        const width = area.width;
        const height = area.height;

        const x = this.cursorX;
        const y = this.cursorY;

        cr.save();

        cr.setOperator(Cairo.Operator.OVER);

        cr.setSourceRGBA(0, 0, 0, this.dimOpacity);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        this.drawSpotlightCircle(cr, x, y);

        cr.restore();
        cr.$dispose();
    }

    private calculateAnimatedRadius(): number {
        const t = this.progress;

        const overshoot =
            1 +
            1.35 * Math.pow(t - 1, 3) +
            0.35 * Math.pow(t - 1, 2);

        return Math.round(
            this.baseRadius *
                (0.42 + overshoot * 0.72)
        );
    }

    private calculateSpotlightRadius(
        radius: number
    ): number {
        return radius * (
            1.15 +
            this.progress * 0.18
        );
    }

    private calculateSpotlightAlpha(): number {
        return (
            0.14 +
            (1 - this.progress) * 0.18
        );
    }

    private drawSpotlightCircle(
        cr: Cairo.Context,
        x: number,
        y: number
    ) {
        const radius =
            this.calculateAnimatedRadius();

        const spotlightRadius =
            this.calculateSpotlightRadius(radius);

        const alpha =
            this.calculateSpotlightAlpha();

        cr.save();

        cr.setOperator(Cairo.Operator.CLEAR);

        cr.arc(
            x,
            y,
            spotlightRadius,
            0,
            Math.PI * 2
        );

        cr.fill();

        cr.restore();

        cr.save();

        cr.setOperator(Cairo.Operator.OVER);

        cr.setSourceRGBA(
            0.9,
            0.9,
            0.9,
            alpha
        );

        cr.arc(
            x,
            y,
            spotlightRadius,
            0,
            Math.PI * 2
        );

        cr.fill();

        cr.restore();
    }

    // Alternative spotlight with a radial gradient. It looks smoother, but can
    // show artifacts when the cursor moves quickly on some Shell/Mutter setups.
    // private drawSpotlightGradient(
    //     cr: Cairo.Context,
    //     x: number,
    //     y: number
    // ) {
    //     const radius =
    //         this.calculateAnimatedRadius();

    //     const spotlightRadius =
    //         this.calculateSpotlightRadius(radius);

    //     const alpha =
    //         this.calculateSpotlightAlpha();

    //     const gradient =
    //         new Cairo.RadialGradient(
    //             x,
    //             y,
    //             0,
    //             x,
    //             y,
    //             spotlightRadius
    //         );

    //     gradient.addColorStopRGBA(
    //         0.0,
    //         1,
    //         1,
    //         1,
    //         alpha + 0.18
    //     );

    //     gradient.addColorStopRGBA(
    //         0.35,
    //         1,
    //         1,
    //         1,
    //         alpha
    //     );

    //     gradient.addColorStopRGBA(
    //         0.72,
    //         1,
    //         1,
    //         1,
    //         alpha * 0.42
    //     );

    //     gradient.addColorStopRGBA(
    //         1.0,
    //         1,
    //         1,
    //         1,
    //         0
    //     );

    //     cr.save();

    //     cr.setOperator(Cairo.Operator.CLEAR);

    //     cr.arc(
    //         x,
    //         y,
    //         spotlightRadius,
    //         0,
    //         Math.PI * 2
    //     );

    //     cr.fill();

    //     cr.restore();

    //     cr.save();

    //     cr.setOperator(Cairo.Operator.OVER);

    //     cr.setSource(gradient);

    //     cr.arc(
    //         x,
    //         y,
    //         spotlightRadius,
    //         0,
    //         Math.PI * 2
    //     );

    //     cr.fill();

    //     cr.restore();
    // }

    private fadeOutAndDestroy() {
        if (this.fadeOutStarted || !this.overlay)
            return;

        this.fadeOutStarted = true;

        this.stopIntroAnimation();
        this.stopPointerPolling();

        const interval = new Clutter.Interval({
            value_type: GObject.TYPE_UINT,
            initial: this.overlay.opacity,
            final: 0,
        });

        const transition = new Clutter.PropertyTransition({
            property_name: 'opacity',
            interval,
            duration: FADE_OUT_DURATION_MS,
            progress_mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        transition.connect('completed', () => {
            this.destroyOverlay();
        });

        this.overlay.add_transition(
            'cursor-locator-fade-out',
            transition
        );
    }

    private destroyOverlay() {
        this.stopIntroAnimation();
        this.stopPointerPolling();

        this.overlay?.remove_transition(
            'cursor-locator-fade-out'
        );

        this.overlay?.destroy();

        this.overlay = null;
        this.area = null;
        this.repaintQueued = false;
        this.fadeOutStarted = false;
    }

    destroy() {
        this.stopJiggleDetection();
        this.destroyOverlay();
    }
}
