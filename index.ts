/* 
TODO:
> Refactor to use Buffer type instead of number[]
*/

interface Options {
    linkTarget: string;
    name?: string;
    workingDirectory?: string;
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
let hasName: number = 0x04;
let hasWorkingDir: number = 0x10;
let hasArguments: number = 0x20;
let hasIconLocation: number = 0x40;

const headerSize: number[] = [0x4c, 0x00,0x00,0x00];
const linkCLSID: number[] = convertCLSIDtoBuff("00021401-0000-0000-c000-000000000046");
const linkFlags_2_3_4: number[] = [0x01,0x00,0x00];
let linkFlags: number[] = [];

const fileAttr: FileAttr = {
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

const clsid: CLSID = {
    computer: convertCLSIDtoBuff("20d04fe0-3aea-1069-a2d8-08002b30309d"),
    network: convertCLSIDtoBuff("208d2c60-3aea-1069-a2d7-08002b30309d")
};

const endOfString: number[] = [0x00];

// Helper functions:

function hexToBuff(hex: string): number[] {
    if (hex.length % 2 !== 0) {
        hex = "0" + hex; // Ensure even-length hex string
    }
    const result: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
        result.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return result;
}


function strToBuff(s: string): number[] {
    return [...s].map((c) => {
      const code: number = c.charCodeAt(0);
      if (code >= 128) {
        throw new Error(`Non-ASCII character detected: ${c}`);
      }
      return code;
    });
  }

  function convertCLSIDtoBuff(clsid: string): number[] {
    const parts = clsid.split('-');
    if (parts.length !== 5) {
        throw new Error(`Invalid CLSID format: ${clsid}`);
    }

    return [
        ...hexToBuff(parts[0]).reverse(), // Little-endian
        ...hexToBuff(parts[1]).reverse(), // Little-endian
        ...hexToBuff(parts[2]).reverse(), // Little-endian
        ...hexToBuff(parts[3]), // Big-endian
        ...hexToBuff(parts[4])  // Big-endian
    ];
}

function generateLinkFlags(): number[] {
    const flag: number[] = [hasLinkTargetIdList + hasName + hasWorkingDir + hasArguments + hasIconLocation];
    return flag.concat(linkFlags_2_3_4);
}

function generateDataBuff(str: string): number[] {
    const buff: number[] = strToBuff(str);
    const size: number[] = [(buff.length + 2) & 0xff, ((buff.length + 2) >> 8) & 0xff];
    return [...size, ...buff, 0x00];
}


function generateIdList(item: number[]): number[] {
    const size = item.length + 2;
    return [(size & 0xff), (size >> 8) & 0xff].concat(item);
}


function createLinkFile(options: Options): Blob {

    const {
        name,
        workingDirectory,
        args,
        icon_location,
    } = options || {};

    let {
        linkTarget
    } = options;

    function buildLinkFlags(): number[] {
        let localHasName = hasName;
        let localHasWorkingDir = hasWorkingDir;
        let localHasArguments = hasArguments;
        let localHasIconLocation = hasIconLocation;
    
        let stringData: number[] = [];

        if (name) {
            stringData = stringData.concat(generateDataBuff(name));
        } else {
            localHasName = 0x00;
        }
    
        if (workingDirectory) {
            stringData = stringData.concat(generateDataBuff(workingDirectory));
        } else {
            localHasWorkingDir = 0x00;
        }
    
        if (args) {
            stringData = stringData.concat(generateDataBuff(args));
        } else {
            localHasArguments = 0x00;
        }
    
        if (icon_location) {
            stringData = stringData.concat(generateDataBuff(icon_location));
        } else {
            localHasIconLocation = 0x00;
        }
    
        return stringData;
    }
    
    
    const stringData: number[] = buildLinkFlags();
    linkFlags = generateLinkFlags();

    let targetIsFolder: boolean = false;
    
    let prefixRoot: number[];
    let itemData: number[];
    let targetRoot: string | number[];
    let targetLeaf: string | number[] = "";

    let prefixOfTarget: number[];
    let fileAttributes: number[];

    // Remove trailing slashes (excluding network root "\\" paths)
    if (linkTarget.endsWith("\\") && linkTarget !== "\\\\") {
        linkTarget = linkTarget.slice(0, -1);
        targetIsFolder = true;
    }

    let parts = linkTarget.split("\\");

if (linkTarget.startsWith("\\\\")) {
    prefixRoot = prefix.networkRoot;
    itemData = [0x1f, 0x58].concat(clsid.network);

    let shareParts = parts.slice(0, 3);
    targetRoot = shareParts.join("\\") + "\\"; // Ensure share root ends with "\"
    targetLeaf = parts.slice(3).join("\\"); // Remaining path (if any)
} else {
    prefixRoot = prefix.localRoot;
    itemData = [0x1f, 0x50].concat(clsid.computer);

    targetRoot = parts[0] + "\\"; // Drive letter
    targetLeaf = parts.slice(1).join("\\"); // Remaining path (if any)
}

    // Ensure `targetLeaf` is properly handled
    if (!targetLeaf) {
        targetLeaf = "";
    }


    if (!targetIsFolder) {
        prefixOfTarget = prefix.file;
        fileAttributes = fileAttr.file;
    } else {
        prefixOfTarget = prefix.folder;
        fileAttributes = fileAttr.dir;
    }

    targetRoot = strToBuff(targetRoot);

    for (let i = 1; i <= 21; ++i) {
        targetRoot.push(0);
    }

    let idListItems: number[] = generateIdList(itemData);

    idListItems = idListItems.concat(
        generateIdList(prefixRoot.concat(targetRoot, endOfString))
    );

    if (targetLeaf && targetLeaf.length) {
        targetLeaf = strToBuff(targetLeaf);
        idListItems = idListItems.concat(
            generateIdList(prefixOfTarget.concat(targetLeaf, endOfString))
        );
    }

    const idList: number[] = generateIdList(idListItems);

    const data: number[] = headerSize.concat(
        linkCLSID,
        linkFlags,
        fileAttributes,
        creationTime,
        accessTime,
        writeTime,
        fileSize,
        iconIndex,
        showCommand,
        hotkey,
        reserved,
        reserved2,
        reserved3,
        idList,
        terminalID,
        stringData,
    );
    return new Blob([new Uint8Array(data)], { type: "application/x-ms-shortcut"});
}

export default createLinkFile;

// Test:
/*
const file = createLinkFile({
    linkTarget: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    name: "start witness",
    workingDirectory: "C:\\Program Files\\Google\\Chrome\\Application",
    args: "--ssl-key-log-file=D:\\sslkeylogfile.log",
});

await Bun.write(`{outdir}/test.lnk`, file);
*/