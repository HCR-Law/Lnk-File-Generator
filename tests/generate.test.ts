import { describe, expect, test } from "bun:test";
import { createLinkBlob } from "../refactor";

describe("snapshot", () => {
    test("byte value match", async () => {
        const generatedBlob = createLinkBlob({
            linkTarget: "C:\\Program Files\\Google\\chrome\\Application\\chrome.exe",
            comment: "Snapshot Test",
        });

        const bytes = await generatedBlob?.bytes();
        const type = generatedBlob?.type;
        const len = generatedBlob?.size;

        expect(bytes).toBeDefined();
        expect(type).toBeDefined();
        expect(len).toBeDefined();

        const snap = { bytes, type, len };

        expect(snap).toMatchSnapshot();
    });
})