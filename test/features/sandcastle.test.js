'use strict';

// sandcastle.js:
//  1. Creates a SandCastle instance at module load — mock 'sandcastle'
//  2. Reads macros from /simojs-data/macros.js in init() — mock 'fs'

let writtenMacros = null;

jest.mock('sandcastle', () => {
    const mockScript = {
        on: jest.fn().mockReturnThis(),
        run: jest.fn(),
    };
    return {
        SandCastle: jest.fn().mockImplementation(() => ({
            createScript: jest.fn().mockReturnValue(mockScript),
        })),
    };
});

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        readFileSync: jest.fn((path, ...args) => {
            if (path === '/simojs-data/macros.js') {
                return JSON.stringify({});
            }
            return actual.readFileSync(path, ...args);
        }),
        writeFile: jest.fn((path, data, callback) => {
            writtenMacros = JSON.parse(data);
            callback(null);
        }),
    };
});

describe('sandcastle feature — macro management', () => {
    let sandcastleFeature;
    let newMacro, delMacro, printMacro, listMacros;
    let mockClient;

    beforeEach(() => {
        writtenMacros = null;
        jest.resetModules();

        // Re-apply mocks after module reset
        jest.doMock('sandcastle', () => {
            const mockScript = {
                on: jest.fn().mockReturnThis(),
                run: jest.fn(),
            };
            return {
                SandCastle: jest.fn().mockImplementation(() => ({
                    createScript: jest.fn().mockReturnValue(mockScript),
                })),
            };
        });
        jest.doMock('fs', () => {
            const actual = jest.requireActual('fs');
            return {
                ...actual,
                readFileSync: jest.fn((path, ...args) => {
                    if (path === '/simojs-data/macros.js') {
                        return JSON.stringify({});
                    }
                    return actual.readFileSync(path, ...args);
                }),
                writeFile: jest.fn((path, data, callback) => {
                    writtenMacros = JSON.parse(data);
                    callback(null);
                }),
            };
        });

        sandcastleFeature = require('../../features/sandcastle');
        sandcastleFeature.init({});

        newMacro = sandcastleFeature.commands['!addmacro'];
        delMacro = sandcastleFeature.commands['!delmacro'];
        printMacro = sandcastleFeature.commands['!printmacro'];
        listMacros = sandcastleFeature.commands['!listmacros'];

        mockClient = { say: jest.fn() };
    });

    describe('!addmacro', () => {
        test('adds a macro with a valid "+" prefix', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +greet return "hello"');
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'added macro');
            expect(writtenMacros).toHaveProperty('+greet');
        });

        test('adds a macro with a valid "_" prefix', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro _hidden return 1');
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'added macro');
            expect(writtenMacros).toHaveProperty('_hidden');
        });

        test('adds a macro with a valid "*" prefix', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro *hyper return 2');
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'added macro');
            expect(writtenMacros).toHaveProperty('*hyper');
        });

        test('rejects macro names that do not start with +, _, or *', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro badname return 1');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('error'));
            // Nothing should have been written
            expect(writtenMacros).toBeNull();
        });

        test('rejects macros that reference themselves (recursion guard)', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +self +self');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('recursion'));
            expect(writtenMacros).toBeNull();
        });

        test('stores the script body correctly', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +calc return 2 + 2');
            expect(writtenMacros['+calc']).toBe('return 2 + 2');
        });
    });

    describe('!listmacros', () => {
        test('returns empty string when no macros exist', () => {
            listMacros(mockClient, '#test', 'user', '!listmacros');
            expect(mockClient.say).toHaveBeenCalledWith('#test', '');
        });

        test('lists macro names after one is added', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +foo return 1');
            mockClient.say.mockClear();
            listMacros(mockClient, '#test', 'user', '!listmacros');
            expect(mockClient.say).toHaveBeenCalledWith('#test', expect.stringContaining('+foo'));
        });

        test('lists all macro names separated by spaces', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +a return 1');
            newMacro(mockClient, '#test', 'user', '!addmacro +b return 2');
            mockClient.say.mockClear();
            listMacros(mockClient, '#test', 'user', '!listmacros');
            const listing = mockClient.say.mock.calls[0][1];
            expect(listing).toContain('+a');
            expect(listing).toContain('+b');
        });
    });

    describe('!printmacro', () => {
        test('prints the content of an existing macro', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +greet return "hello"');
            mockClient.say.mockClear();
            printMacro(mockClient, '#test', 'user', '!printmacro +greet');
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'return "hello"');
        });

        test('returns undefined for a non-existent macro (no crash)', () => {
            // printMacro does macros[name] — for missing key this is undefined
            expect(() => {
                printMacro(mockClient, '#test', 'user', '!printmacro +nonexistent');
            }).not.toThrow();
        });
    });

    describe('!delmacro', () => {
        test('removes an existing macro', () => {
            newMacro(mockClient, '#test', 'user', '!addmacro +bye return 0');
            mockClient.say.mockClear();
            delMacro(mockClient, '#test', 'user', '!delmacro +bye');
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'removed');
            expect(writtenMacros).not.toHaveProperty('+bye');
        });

        test('silently succeeds when deleting a non-existent macro', () => {
            expect(() => {
                delMacro(mockClient, '#test', 'user', '!delmacro +ghost');
            }).not.toThrow();
            expect(mockClient.say).toHaveBeenCalledWith('#test', 'removed');
        });
    });
});
