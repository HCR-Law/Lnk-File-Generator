interface Options {
    linkTarget: string;
    name?: string;
    workingDirectory?: string;
    args?: string;
    icon_location?: string;
}

interface FileAttr {
    dir: Buffer;
    file: Buffer;
}

interface CLSID {
    computer: Buffer;
    network: Buffer;
}

interface Prefix {
    localRoot: Buffer;
    folder: Buffer;
    file: Buffer;
    networkRoot: Buffer;
}

// Declarations

const hasLinkTargetIdList: number = 0x01;
let hasName: number = 0x04;
let hasWorkingDir: number = 0x10;
let hasArguments: number = 0x20;
let hasIconLocation: number = 0x40;

const headerSize: Buffer<ArrayBuffer> = Buffer.from([0x4c, 0x00, 0x00, 0x00]);
const linkCLSID: Buffer<ArrayBufferLike> = convertCLSIDtoBuff("00021401-0000-0000-c000-000000000046");
const linkFlags_2_3_4: Buffer<ArrayBuffer> = Buffer.from([0x01, 0x00, 0x00]);
let linkFlags: Buffer;

const fileAttr: FileAttr = {
    dir: Buffer.from([0x10, 0x00, 0x00, 0x00]),
    file: Buffer.from([0x20, 0x00, 0x00, 0x00])
};

const creationTime = Buffer.alloc(8);
const accessTime = Buffer.alloc(8);
const writeTime = Buffer.alloc(8);
const fileSize = Buffer.alloc(4);
const iconIndex = Buffer.alloc(4);
const showCommand = Buffer.from([0x01, 0x00, 0x00, 0x00]);
const hotkey = Buffer.alloc(2);
const reserved = Buffer.alloc(2);
const reserved2 = Buffer.alloc(4);
const reserved3 = Buffer.alloc(4);
const terminalID = Buffer.alloc(2);
const endOfString = Buffer.from([0x00]);

const prefix: Prefix = {
    localRoot: Buffer.from([0x2f]),
    folder: Buffer.from([0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    file: Buffer.from([0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    networkRoot: Buffer.from([0xc3, 0x01, 0x81])
};

const clsid: CLSID = {
    computer: convertCLSIDtoBuff("20d04fe0-3aea-1069-a2d8-08002b30309d"),
    network: convertCLSIDtoBuff("208d2c60-3aea-1069-a2d7-08002b30309d")
};

// Helper Functions

function convertCLSIDtoBuff(clsid: string): Buffer {
    const parts = clsid.split('-').map(hex => Buffer.from(hex.match(/../g)!.map(byte => parseInt(byte, 16))));
    return Buffer.concat([parts[0].reverse(), parts[1].reverse(), parts[2].reverse(), parts[3], parts[4]]);
}

function strToBuff(s: string): Buffer {
    return Buffer.from(s, "ascii");
}

function generateDataBuff(str: string): Buffer {
    const buff = strToBuff(str);
    const size = Buffer.from([(buff.length + 2) & 0xff, ((buff.length + 2) >> 8) & 0xff]);
    return Buffer.concat([size, buff, endOfString]);
}

function generateLinkFlags(): Buffer {
    return Buffer.concat([Buffer.from([hasLinkTargetIdList + hasName + hasWorkingDir + hasArguments + hasIconLocation]), linkFlags_2_3_4]);
}

// Main Function

function createLinkFile(options: Options): Blob {
    const { name, workingDirectory, args, icon_location } = options;
    let { linkTarget } = options;

    let stringData: Buffer<ArrayBuffer> = Buffer.alloc(0);

    if (name) stringData = Buffer.concat([stringData, generateDataBuff(name)]);
    if (workingDirectory) stringData = Buffer.concat([stringData, generateDataBuff(workingDirectory)]);
    if (args) stringData = Buffer.concat([stringData, generateDataBuff(args)]);
    if (icon_location) stringData = Buffer.concat([stringData, generateDataBuff(icon_location)]);

    linkFlags = generateLinkFlags();
    let targetIsFolder: boolean = linkTarget.endsWith("\\") && linkTarget !== "\\";
    if (targetIsFolder) linkTarget = linkTarget.slice(0, -1);

    let parts: string[] = linkTarget.split("\\");
    let prefixRoot: Buffer;
	let itemData: Buffer;
	let targetRoot: Buffer;
	let targetLeaf: Buffer;

    if (linkTarget.startsWith("\\\\")) {
        prefixRoot = prefix.networkRoot;
        itemData = Buffer.concat([Buffer.from([0x1f, 0x58]), clsid.network]);
        targetRoot = strToBuff(parts.slice(0, 3).join("\\") + "\\");
        targetLeaf = strToBuff(parts.slice(3).join("\\"));
    } else {
        prefixRoot = prefix.localRoot;
        itemData = Buffer.concat([Buffer.from([0x1f, 0x50]), clsid.computer]);
        targetRoot = strToBuff(parts[0] + "\\");
        targetLeaf = strToBuff(parts.slice(1).join("\\"));
    }

    targetRoot = Buffer.concat([targetRoot, Buffer.alloc(21 - targetRoot.length)]);
    let idList = Buffer.concat([itemData, prefixRoot, targetRoot, endOfString]);
    if (targetLeaf.length) idList = Buffer.concat([idList, prefix.file, targetLeaf, endOfString]);

    const data: Buffer<ArrayBuffer> = Buffer.concat([
        headerSize, linkCLSID, linkFlags, fileAttr.file, creationTime, accessTime, writeTime, fileSize,
        iconIndex, showCommand, hotkey, reserved, reserved2, reserved3, idList, terminalID, stringData
    ]);

    return new Blob([data], { type: "application/x-ms-shortcut" });
}

export default createLinkFile;

// Example: 
/*
const file = createLinkFile({
    linkTarget: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    name: "start witness",
    workingDirectory: "C:\\Program Files\\Google\\Chrome\\Application",
    args: "--ssl-key-log-file=D:\\sslkeylogfile.log",
});

await Bun.write(`{outdir}/test.lnk`, file);
*/