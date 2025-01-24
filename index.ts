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

interface FileAttr {
    dir: number[];
    file: number[];
}

interface CLSID {
    computer: number[];
    network: number[];
}

interface Prefix {
    localRoot: number[];
    folder: number[];
    file: number[];
    networkRoot: number[];
}

// Declarations

const hasLinkTargetIdList: number = 0x01;
const hasName: number = 0x04;
const hasWorkingDir: number = 0x10;
const hasArguments: number = 0x20;
const hasIconLocation: number = 0x40;

const headSize: number[] = [0x4c, 0x00,0x00,0x00];
const linkCLSID: number[] = convertCLSIDtoBuff("00021401-0000-0000-c000-000000000046");
const linkFlags_2_3_4: number[] = [0x01,0x00,0x00];
const linkFlags: number[] = [];

const fileAttributes: FileAttr = {
    dir: [0x10,0x00,0x00,0x00],
    file: [0x20,0x00,0x00,0x00]
};

const creationTime: number[] = [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
const accessTime: number[] = [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
const writeTime: number[] = [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00];

const fileSize: number[] = [0x00,0x00,0x00,0x00];
const iconIndex: number[] = [0x00,0x00,0x00,0x00];
const showCommand: number[] = [0x01,0x00,0x00,0x00]; //SW_SHOWNORMAL
const hotkey: number[] = [0x00,0x00]; // No Hotkey
const reserved: number[] = [0x00,0x00];
const reserved2: number[] = [0x00,0x00,0x00,0x00];
const reserved3: number[] = [0x00,0x00,0x00,0x00];
const terminalID: number[] = [0x00,0x00];

const prefix: Prefix = {
    localRoot: [0x2f],
    folder: [0x31,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    file: [0x32,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    networkRoot: [0xc3,0x01,0x81]
};

const endOfString: number[] = [0x00];

// Helper functions:

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

function strToBuff(s: string): number[] {
    return [...s].map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 128) {
        throw new Error(`Non-ASCII character detected: ${c}`);
      }
      return code;
    });
  }

function convertCLSIDtoBuff(clsid: string): number[] {
    const idx: [number, number][] = [[6,2], [4,2], [2,2], [0,2],
        [11,2], [9,2], [16,2], [14,2],
        [19,4], [24,12]];
    const arr: string[] = idx.map((x) => {
        return clsid.substring(x[0], x[1]);
    });

    return hexToBuff(arr.join(""));
}

function generateLinkFlags(): number[] {
    const flag: number[] = [hasLinkTargetIdList + hasName + hasWorkingDir + hasArguments + hasIconLocation];
    return flag.concat(linkFlags_2_3_4);
}

function generateDataString(str: string): number[] {
    const buff: number[] = strToBuff(str);
    const buffSize: string = (0x10000 + buff.length).toString(16).substring(1);
    return hexToBuff(buffSize.replace(/(..)(..)/, "$2$1")).concat(buff);
}

function generateIdList(item: number[]): number[] {
    const buffSize: string = (0x0000 + item.length + 2).toString(16).substring(1);
    return hexToBuff(buffSize.replace(/(..)(..)/, '$2$1')).concat(item);
}


