/* 
TODO:
> Refactor to use Buffer type instead of number[]
*/

interface Options {
    linkTarget: string;
    name: string;
    workingDirectory: string;
    args?: string;
    icon_location?: string;
}

function hexToBuff(hex: string): number[] {
    const result: number[] = [];
    let i = 0;

    for (; i < hex.length - 1; i += 2) {
        result.push(+(`0x` + hex.substring(i, i + 2)));
    }

    if (hex.length % 2 !== 0) {
        result.push(+(`0x0` + hex.charAt(i)));
    }

    return result;
}

function stringToBuff(str: string): number[] {
    const result: number[] = [];

    for (let i = 0; i < str.length; ++i) {
        const charCode: number = str.charCodeAt(i);
        if (charCode >= 128) {
            throw new Error(`Non-ASCII char detected: "${str[i]}"`);
        }
        result[i] = charCode;
    }

    return result;
}