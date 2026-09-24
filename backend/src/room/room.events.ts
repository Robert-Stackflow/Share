import { Subject } from "rxjs";

/** Change signals shared by room writes and library-to-room copies. */
export const roomChanges = new Subject<string>();
export const roomListChanges = new Subject<string>();
