'use strict';

const concat = require('../../lib/concat');

describe('concat', () => {
    test('returns line1 when no wholecmd given', () => {
        expect(concat('hello world')).toBe('hello world');
    });

    test('strips newlines from line1 when no wholecmd', () => {
        expect(concat('hello\nworld')).toBe('helloworld');
        expect(concat('hello\r\nworld')).toBe('helloworld');
        expect(concat('hello\rworld')).toBe('helloworld');
    });

    test('returns line1 when line2 (args after command) is empty', () => {
        expect(concat('hello world', '!puppu')).toBe('hello world');
    });

    test('concatenates on first matching word', () => {
        // line1 has "quick", line2 args start with "quick"
        const result = concat('The quick brown fox', '!puppu quick jump');
        // match at word "quick" (index 1 in line1_arr):
        // line1_arr.slice(0, 1) = ["The"] + line2_arr.slice(0) = ["quick","jump"]
        // → "The quick jump"
        expect(result).toBe('The quick jump');
    });

    test('concatenates on comma when no word match', () => {
        // comma1 = "Hello, world".indexOf(',') = 5
        // comma2 = "!cmd Hi, there".indexOf(',') → in line2 (args): "Hi, there".indexOf(',') = 2
        // line2 args = "Hi, there" → result = "Hello" + ", there"
        const result = concat('Hello, world today', '!cmd Hi, there!');
        expect(result).toBe('Hello, there!');
    });

    test('concatenates at end of sentence when no word match and no comma in both', () => {
        // end_of_sentence = 18 (first '.' in line1)
        // line1.slice(0, 19) = "This is a sentence." → + " " + line2_args
        const result = concat('This is a sentence. And more.', '!puppu extra content');
        expect(result).toBe('This is a sentence. extra content');
    });

    test('plain appends line2 when no match, comma, or period', () => {
        const result = concat('just some text', '!puppu extra stuff');
        expect(result).toBe('just some text extra stuff');
    });

    test('strips newlines from both lines', () => {
        const result = concat('line1\r\n', '!cmd line2\n');
        expect(result).toBe('line1 line2');
    });

    test('concatenates on last matching word when earlier words also match', () => {
        // line1: "cat dog cat", line2_args: "cat fish"
        // First match is at index 0 ("cat"):
        // result = [] + ["cat","fish"] = "cat fish"
        const result = concat('cat dog cat', '!cmd cat fish');
        expect(result).toBe('cat fish');
    });

    test('comma concatenation is used when both strings have commas but no matching words', () => {
        const result = concat('Alpha, beta gamma', '!x Delta, epsilon');
        // comma1 = 5, comma2 = 5 (in line2 args "Delta, epsilon")
        expect(result).toBe('Alpha, epsilon');
    });
});
