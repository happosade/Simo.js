'use strict';

// sqlite3's native binary is not available in all environments, so we provide
// a complete in-memory mock that faithfully simulates the timer table operations.

const rows = [];

jest.mock('sqlite3', () => {
    const mockDb = {
        serialize: jest.fn((fn) => fn && fn()),
        run: jest.fn((sql, ...args) => {
            const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
            const params = args;
            const s = sql.replace(/\s+/g, ' ').trim().toUpperCase();

            if (s.startsWith('CREATE TABLE')) {
                // table already "exists" in our in-memory rows array
            } else if (s.startsWith('INSERT INTO TIMER')) {
                rows.push({
                    date: params[0],
                    channel: params[1],
                    sender: params[2],
                    message: params[3],
                    disabled: 0,
                });
            } else if (s.startsWith('UPDATE TIMER SET DISABLED')) {
                const cutoff = params[0];
                rows.forEach((r) => { if (r.date <= cutoff) r.disabled = 1; });
            } else if (s.startsWith('DELETE FROM TIMER')) {
                const idx = rows.findIndex((r) => r.date === params[0]);
                if (idx !== -1) rows.splice(idx, 1);
            }

            if (cb) cb(null);
        }),
        all: jest.fn((sql, ...args) => {
            const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
            const [future, past] = args;
            const result = rows.filter(
                (r) => (r.date <= future && r.disabled === 0) || r.date <= past
            );
            if (cb) cb(null, result);
        }),
        get: jest.fn((sql, ...args) => {
            const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
            const date = args[0];
            const exists = rows.some((r) => r.date === date) ? 1 : 0;
            // timerdb uses _.values(row)[0] so key name is irrelevant
            if (cb) cb(null, { exists });
        }),
    };

    return {
        verbose: () => ({
            Database: jest.fn((path, callback) => {
                if (callback) process.nextTick(() => callback(null));
                return mockDb;
            }),
        }),
    };
});

// Clear the shared rows array before each test
beforeEach(() => {
    rows.length = 0;
});

const { TimerDB } = require('../../lib/timerdb');

describe('TimerDB', () => {
    let db;

    beforeEach(() => {
        db = new TimerDB();
    });

    describe('schedule()', () => {
        test('inserts a timer row and returns the date via callback', (done) => {
            const futureDate = Math.floor(Date.now() / 1000) + 60;
            db.schedule(futureDate, '#test', 'user', 'Timer message', (err, date) => {
                expect(err).toBeNull();
                expect(date).toBe(futureDate);
                expect(rows).toHaveLength(1);
                expect(rows[0]).toMatchObject({
                    date: futureDate,
                    channel: '#test',
                    sender: 'user',
                    message: 'Timer message',
                    disabled: 0,
                });
                done();
            });
        });

        test('increments date by 1 when the given timestamp already exists', (done) => {
            const futureDate = Math.floor(Date.now() / 1000) + 60;
            db.schedule(futureDate, '#ch', 'u', 'First', (err, date1) => {
                expect(err).toBeNull();
                db.schedule(futureDate, '#ch', 'u', 'Second', (err, date2) => {
                    expect(err).toBeNull();
                    // The second entry must use date + 1 to avoid the UNIQUE constraint
                    expect(date2).toBe(date1 + 1);
                    expect(rows).toHaveLength(2);
                    done();
                });
            });
        });

        test('keeps incrementing until a free slot is found', (done) => {
            const base = Math.floor(Date.now() / 1000) + 120;
            db.schedule(base, '#ch', 'u', 'A', () => {
                db.schedule(base, '#ch', 'u', 'B', () => {
                    db.schedule(base, '#ch', 'u', 'C', (err, date) => {
                        expect(err).toBeNull();
                        expect(date).toBe(base + 2);
                        done();
                    });
                });
            });
        });
    });

    describe('poll()', () => {
        test('returns an EventEmitter', () => {
            const emitter = db.poll(5);
            expect(typeof emitter.on).toBe('function');
            expect(typeof emitter.emit).toBe('function');
        });

        test('emits "receive" with an array of due rows on _poll()', (done) => {
            const pastDate = Math.floor(Date.now() / 1000) - 10;
            db.schedule(pastDate, '#test', 'user', 'Overdue timer', () => {
                const emitter = db.poll(5);
                emitter.on('receive', (receivedRows) => {
                    expect(Array.isArray(receivedRows)).toBe(true);
                    const found = receivedRows.find((r) => r.message === 'Overdue timer');
                    expect(found).toBeTruthy();
                    done();
                });
                db._poll(5);
            });
        });

        test('does not emit future timers as due', (done) => {
            const futureDate = Math.floor(Date.now() / 1000) + 3600;
            db.schedule(futureDate, '#test', 'user', 'Future timer', () => {
                const emitter = db.poll(5);
                emitter.on('receive', (receivedRows) => {
                    const found = receivedRows.find((r) => r.message === 'Future timer');
                    expect(found).toBeUndefined();
                    done();
                });
                db._poll(5);
            });
        });
    });

    describe('done()', () => {
        test('removes the timer row with the given date', (done) => {
            const futureDate = Math.floor(Date.now() / 1000) + 60;
            db.schedule(futureDate, '#test', 'user', 'To be removed', (err, date) => {
                expect(err).toBeNull();
                expect(rows).toHaveLength(1);
                db.done(date);
                // Give the mock's synchronous delete a tick to complete
                setImmediate(() => {
                    expect(rows).toHaveLength(0);
                    done();
                });
            });
        });

        test('does not crash when called with a non-existent date', () => {
            expect(() => db.done(9999999999)).not.toThrow();
        });
    });
});
