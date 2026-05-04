import { Observable } from 'rxjs';
/**
 * GAN Smart Timer events/states
 */
declare enum GanTimerState {
    /** Fired when timer is disconnected from bluetooth */
    DISCONNECT = 0,
    /** Grace delay is expired and timer is ready to start */
    GET_SET = 1,
    /** Hands removed from the timer before grace delay expired */
    HANDS_OFF = 2,
    /** Timer is running */
    RUNNING = 3,
    /** Timer is stopped, this event includes recorded time */
    STOPPED = 4,
    /** Timer is reset and idle */
    IDLE = 5,
    /** Hands are placed on the timer */
    HANDS_ON = 6,
    /** Timer moves to this state immediately after STOPPED */
    FINISHED = 7
}
/**
 * Representation of time value
 */
interface GanTimerTime {
    readonly minutes: number;
    readonly seconds: number;
    readonly milliseconds: number;
    readonly asTimestamp: number;
    toString(): string;
}
/**
 * Timer state event
 */
interface GanTimerEvent {
    /** Current timer state */
    state: GanTimerState;
    /** Recorder time value in case of STOPPED event */
    recordedTime?: GanTimerTime;
}
/**
 * Representation of recorded in timer memory time values
 */
interface GanTimerRecordedTimes {
    displayTime: GanTimerTime;
    previousTimes: [GanTimerTime, GanTimerTime, GanTimerTime];
}
/**
 * GAN Timer connection object representing connection API and state
 */
interface GanTimerConnection {
    /** RxJS Subject to subscribe for cube event messages */
    events$: Observable<GanTimerEvent>;
    /** Retrieve last time values recored by timer */
    getRecordedTimes(): Promise<GanTimerRecordedTimes>;
    /** Disconnect from timer */
    disconnect(): void;
}
/**
 * Construct time object
 */
declare function makeTime(min: number, sec: number, msec: number): GanTimerTime;
/**
 * Construct time object from milliseconds timestamp
 */
declare function makeTimeFromTimestamp(timestamp: number): GanTimerTime;
/**
 * Initiate new connection with the GAN Smart Timer device
 * @returns Connection connection object representing connection API and state
 */
declare function connectGanTimer(): Promise<GanTimerConnection>;
export type { GanTimerConnection, GanTimerEvent, GanTimerTime, GanTimerRecordedTimes };
export { connectGanTimer, makeTime, makeTimeFromTimestamp, GanTimerState };
//# sourceMappingURL=gan-smart-timer.d.ts.map