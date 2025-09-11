import { describe, it, expect } from 'vitest';
import Convert, { type ConverterOptions } from './ansi_to_html.js'; // Adjust the path if your compiled TS is in a different directory

/**
 * Helper function to run a test with given text, expected result, and options.
 * @param text The input string or array of strings containing ANSI escape codes.
 * @param expectedResult The expected HTML output.
 * @param opts Optional ConverterOptions to pass to the Convert constructor.
 */
function runTest(text: string | string[], expectedResult: string, opts?: ConverterOptions): void {
    const options: ConverterOptions = opts || {};
    const converter = new Convert(options);

    // Ensure text is always an array for consistent reduce behavior
    const inputTextArray = Array.isArray(text) ? text : [text];

    const actualResult = inputTextArray.reduce((memo: string, t: string) => memo + converter.toHtml(t), '');
    expect(actualResult).to.equal(expectedResult);
}

describe('ansi to html', () => {
    describe('constructed with no options', () => {
        it('doesn\'t modify the input string', () => {
            const text = 'some text';
            const result = 'some text';
            runTest(text, result);
        });

        it('returns plain text when given plain text with LF', () => {
            const text = 'test\ntest\n';
            const result = 'test\ntest\n';
            runTest(text, result);
        });

        it('returns plain text when given plain text with multiple LF', () => {
            const text = 'test\n\n\ntest\n';
            const result = 'test\n\n\ntest\n';
            runTest(text, result);
        });

        it('returns plain text when given plain text with CR', () => {
            const text = 'testCRLF\rtest';
            const result = 'testCRLF\rtest';
            runTest(text, result);
        });

        it('returns plain text when given plain text with multiple CR', () => {
            const text = 'testCRLF\r\r\rtest';
            const result = 'testCRLF\r\r\rtest';
            runTest(text, result);
        });

        it('returns plain text when given plain text with CR & LF', () => {
            const text = 'testCRLF\r\ntest';
            const result = 'testCRLF\r\ntest';
            runTest(text, result);
        });

        it('returns plain text when given plain text with multiple CR & LF', () => {
            const text = 'testCRLF\r\n\r\ntest';
            const result = 'testCRLF\r\n\r\ntest';
            runTest(text, result);
        });

        it('renders foreground colors', () => {
            const text = 'colors: \x1b[30mblack\x1b[37mwhite';
            const result = 'colors: <span style="color:#000">black<span style="color:#AAA">white</span></span>';
            runTest(text, result);
        });

        it('renders light foreground colors', () => {
            const text = 'colors: \x1b[90mblack\x1b[97mwhite';
            const result = 'colors: <span style="color:#555">black<span style="color:#FFF">white</span></span>';
            runTest(text, result);
        });

        it('renders background colors', () => {
            const text = 'colors: \x1b[40mblack\x1b[47mwhite';
            const result = 'colors: <span style="background-color:#000">black<span style="background-color:#AAA">white</span></span>';
            runTest(text, result);
        });

        it('renders light background colors', () => {
            const text = 'colors: \x1b[100mblack\x1b[107mwhite';
            const result = 'colors: <span style="background-color:#555">black<span style="background-color:#FFF">white</span></span>';
            runTest(text, result);
        });

        it('renders strikethrough', () => {
            const text = 'strike: \x1b[9mthat';
            const result = 'strike: <strike>that</strike>';
            runTest(text, result);
        });

        it('renders blink', () => {
            const text = 'blink: \x1b[5mwhat';
            const result = 'blink: <blink>what</blink>';
            runTest(text, result);
        });

        it('renders underline', () => {
            const text = 'underline: \x1b[4mstuff';
            const result = 'underline: <u>stuff</u>';
            runTest(text, result);
        });

        it('renders bold', () => {
            const text = 'bold: \x1b[1mstuff';
            const result = 'bold: <b>stuff</b>';
            runTest(text, result);
        });

        it('renders italic', () => {
            const text = 'italic: \x1b[3mstuff';
            const result = 'italic: <i>stuff</i>';
            runTest(text, result);
        });

        it('handles resets', () => {
            const text = '\x1b[1mthis is bold\x1b[0m, but this isn\'t';
            const result = '<b>this is bold</b>, but this isn\'t';
            runTest(text, result);
        });

        it('handles multiple resets', () => {
            const text = 'normal, \x1b[1mbold, \x1b[4munderline, \x1b[31mred\x1b[0m, normal';
            const result = 'normal, <b>bold, <u>underline, <span style="color:#A00">red</span></u></b>, normal';
            runTest(text, result);
        });

        it('handles resets with implicit 0', () => {
            const text = '\x1b[1mthis is bold\x1b[m, but this isn\'t';
            const result = '<b>this is bold</b>, but this isn\'t';
            runTest(text, result);
        });

        it('renders multi-attribute sequences', () => {
            const text = 'normal, \x1b[1;4;31mbold, underline, and red\x1b[0m, normal';
            const result = 'normal, <b><u><span style="color:#A00">bold, underline, and red</span></u></b>, normal';
            runTest(text, result);
        });

        it('renders multi-attribute sequences with a semi-colon', () => {
            const text = 'normal, \x1b[1;4;31;mbold, underline, and red\x1b[0m, normal';
            const result = 'normal, <b><u><span style="color:#A00">bold, underline, and red</span></u></b>, normal';
            runTest(text, result);
        });

        it('eats malformed sequences', () => {
            const text = '\x1b[25oops forgot the \'m\'';
            const result = 'oops forgot the \'m\'';
            runTest(text, result);
        });

        it('renders xterm 256 foreground sequences', () => {
            const text = '\x1b[38;5;196mhello';
            const result = '<span style="color:#ff0000">hello</span>';
            runTest(text, result);
        });

        it('renders xterm 256 background sequences', () => {
            const text = '\x1b[48;5;196mhello';
            const result = '<span style="background-color:#ff0000">hello</span>';
            runTest(text, result);
        });

        it('renders foreground rgb sequences', () => {
            const text = '\x1b[38;2;210;60;114mhello';
            const result = '<span style="color:#d23c72">hello</span>';
            runTest(text, result);
        });

        it('renders background rgb sequences', () => {
            const text = '\x1b[48;2;155;42;45mhello';
            const result = '<span style="background-color:#9b2a2d">hello</span>';
            runTest(text, result);
        });

        it('handles resetting to default foreground color', () => {
            const text = '\x1b[30mblack\x1b[39mdefault';
            const result = '<span style="color:#000">black<span style="color:#FFF">default</span></span>';
            runTest(text, result);
        });

        it('handles resetting to default background color', () => {
            const text = '\x1b[100mblack\x1b[49mdefault';
            const result = '<span style="background-color:#555">black<span style="background-color:#000">default</span></span>';
            runTest(text, result);
        });

        it('is able to disable underline', () => {
            const text = 'underline: \x1b[4mstuff\x1b[24mthings';
            const result = 'underline: <u>stuff</u>things';
            runTest(text, result);
        });

        it('is able to skip disabling underline', () => {
            const text = 'not underline: stuff\x1b[24mthings';
            const result = 'not underline: stuffthings';
            runTest(text, result);
        });

        it('renders two escape sequences in sequence', () => {
            const text = 'months remaining\x1b[1;31mtimes\x1b[m\x1b[1;32mmultiplied by\x1b[m $10';
            const result = 'months remaining<b><span style="color:#A00">times</span></b><b><span style="color:#0A0">multiplied by</span></b> $10';
            runTest(text, result);
        });

        it('drops EL code with no parameter', () => {
            const text = '\x1b[Khello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops EL code with 0 parameter', () => {
            const text = '\x1b[0Khello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops EL code with 0 parameter after new line character', () => {
            const text = 'HELLO\n\x1b[0K\u001b[33;1mWORLD\u001b[0m\n';
            const result = 'HELLO\n<span style="color:#A50"><b>WORLD</b></span>\n';
            runTest(text, result);
        });

        it('drops EL code with 1 parameter', () => {
            const text = '\x1b[1Khello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops EL code with 2 parameter', () => {
            const text = '\x1b[2Khello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops ED code with 0 parameter', () => {
            const text = '\x1b[Jhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops ED code with 1 parameter', () => {
            const text = '\x1b[1Jhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops HVP code with 0 parameter', () => {
            const text = '\x1b[;fhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops HVP code with 1 parameter', () => {
            const text = '\x1b[123;fhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops HVP code with 2 parameter', () => {
            const text = '\x1b[123;456fhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('drops setusg0 sequence', () => {
            const text = '\x1b[(Bhello';
            const result = 'hello';
            runTest(text, result);
        });

        it('renders un-italic code appropriately', () => {
            const text = '\x1b[3mHello\x1b[23m World';
            const result = '<i>Hello</i> World';
            runTest(text, result);
        });

        it('skips rendering un-italic code appropriately', () => {
            const text = 'Hello\x1b[23m World';
            const result = 'Hello World';
            runTest(text, result);
        });

        it('renders overline', () => {
            const text = '\x1b[53mHello World';
            const result = '<span style="text-decoration:overline">Hello World</span>';
            runTest(text, result);
        });

        it('renders normal text', () => {
            const text = '\x1b[22mnormal text';
            const result = '<span style="font-weight:normal;text-decoration:none;font-style:normal">normal text</span>';
            runTest(text, result);
        });

        it('renders text following carriage return (CR, mac style line break)', () => {
            const text = 'ANSI Hello\rWorld';
            const result = 'ANSI Hello\rWorld';
            runTest(text, result);
        });
    });

    // Requirement 3: `escapeXML` and `entities` have been removed.
    // The following block of tests for `escapeXML` is therefore also removed.
    /*
    describe('with escapeXML option enabled', function () {
        it('escapes XML entities', function (done) {
            const text = 'normal, \x1b[1;4;31;mbold, <underline>, and red\x1b[0m, normal';
            const result = 'normal, <b><u><span style="color:#A00">bold, &lt;underline&gt;, and red</span></u></b>, normal';
            return runTest(text, result, {escapeXML: true});
        });
    });
    */

    describe('with newline option enabled', () => {
        it('renders line breaks', () => {
            const text = 'test\ntest\n';
            const result = 'test<br/>test<br/>';
            runTest(text, result, { newline: true });
        });

        it('renders multiple line breaks', () => {
            const text = 'test\n\ntest\n';
            const result = 'test<br/><br/>test<br/>';
            runTest(text, result, { newline: true });
        });

        it('renders mac styled line breaks (CR)', () => {
            const text = 'test\rtest\r';
            const result = 'test<br/>test<br/>';
            runTest(text, result, { newline: true });
        });

        it('renders multiple mac styled line breaks (CR)', () => {
            const text = 'test\r\rtest\r';
            const result = 'test<br/><br/>test<br/>';
            runTest(text, result, { newline: true });
        });

        it('renders windows styled line breaks (CR+LF)', () => {
            const text = 'testCRLF\r\ntestLF';
            const result = 'testCRLF<br/>testLF';
            runTest(text, result, { newline: true });
        });

        it('renders windows styled line breaks (multi CR+LF)', () => {
            const text = 'testCRLF\r\n\r\ntestLF';
            const result = 'testCRLF<br/><br/>testLF';
            runTest(text, result, { newline: true });
        });
    });

    describe('with stream option enabled', () => {
        it('persists styles between toHtml() invocations', () => {
            const text = ['\x1b[31mred', 'also red'];
            const result = '<span style="color:#A00">red</span><span style="color:#A00">also red</span>';
            runTest(text, result, { stream: true });
        });

        it('persists styles between more than two toHtml() invocations', () => {
            const text = ['\x1b[31mred', 'also red', 'and red'];
            const result = '<span style="color:#A00">red</span><span style="color:#A00">also red</span><span style="color:#A00">and red</span>';
            runTest(text, result, { stream: true });
        });

        it('does not persist styles beyond their usefulness', () => {
            const text = ['\x1b[31mred', 'also red', '\x1b[30mblack', 'and black'];
            const result = '<span style="color:#A00">red</span><span style="color:#A00">also red</span><span style="color:#A00"><span style="color:#000">black</span></span><span style="color:#000">and black</span>';
            runTest(text, result, { stream: true });
        });

        it('removes one state when encountering a reset', () => {
            const text = ['\x1b[1mthis is bold\x1b[0m, but this isn\'t', ' nor is this'];
            const result = '<b>this is bold</b>, but this isn\'t nor is this';
            runTest(text, result, { stream: true });
        });

        it('removes multiple state when encountering a reset', () => {
            const text = ['\x1b[1mthis \x1b[9mis bold\x1b[0m, but this isn\'t', ' nor is this'];
            const result = '<b>this <strike>is bold</strike></b>, but this isn\'t nor is this';
            runTest(text, result, { stream: true });
        });
    });

    describe('with custom colors enabled', () => {
        it('renders basic colors', () => {
            const text = ['\x1b[31mblue', 'not blue'];
            const result = '<span style="color:#00A">blue</span>not blue';
            runTest(text, result, { colors: { 1: '#00A' } });
        });

        it('renders basic colors with streaming', () => {
            const text = ['\x1b[31mblue', 'also blue'];
            const result = '<span style="color:#00A">blue</span><span style="color:#00A">also blue</span>';
            runTest(text, result, { stream: true, colors: { 1: '#00A' } });
        });

        it('renders custom colors and default colors', () => {
            const text = ['\x1b[31mblue', 'not blue', '\x1b[94mlight blue', 'not colored'];
            const result = '<span style="color:#00A">blue</span>not blue<span style="color:#55F">light blue</span>not colored';
            runTest(text, result, { colors: { 1: '#00A' } });
        });

        it('renders custom colors and default colors together', () => {
            const text = ['\x1b[31mblue', 'not blue', '\x1b[94mlight blue', 'not colored'];
            const result = '<span style="color:#00A">blue</span>not blue<span style="color:#55F">light blue</span>not colored';
            runTest(text, result, { colors: { 1: '#00A' } });
        });

        it('renders custom 8/ 16 colors', () => {
            // code - 90 + 8 = color
            // so 94 - 90 + 8 = 12
            const text = ['\x1b[94mlighter blue'];
            const result = '<span style="color:#33F">lighter blue</span>';
            runTest(text, result, { colors: { 12: '#33F' } });
        });

        it('renders custom 256 colors', () => {
            // code - 90 + 8 = color
            // so 94 - 90 + 8 = 12
            const text = ['\x1b[38;5;125mdark red', 'then \x1b[38;5;126msome other color'];
            const result = '<span style="color:#af005f">dark red</span>then <span style="color:#af225f">some other color</span>';
            runTest(text, result, { colors: { 126: '#af225f' } });
        });
    });
});