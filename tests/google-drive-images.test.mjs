import assert from "node:assert/strict";
import { test } from "node:test";
import { contentImageUrls, googleDriveImageUrl } from "../src/lib/club/google-drive.ts";

const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz";
const direct = `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;

test("Google Drive share links become direct displayable image URLs", () => {
  assert.equal(
    googleDriveImageUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`),
    direct,
  );
  assert.equal(googleDriveImageUrl(`https://drive.google.com/open?id=${id}`), direct);
  assert.equal(googleDriveImageUrl(`https://drive.google.com/uc?export=view&id=${id}`), direct);
  assert.equal(googleDriveImageUrl(direct), direct);
});

test("non-Drive and malformed links are rejected", () => {
  assert.equal(googleDriveImageUrl("https://example.com/image.jpg"), undefined);
  assert.equal(googleDriveImageUrl("https://drive.google.com/file/d/short/view"), undefined);
  assert.equal(googleDriveImageUrl("javascript:alert(1)"), undefined);
});

test("Drive images are preferred while legacy images remain available", () => {
  assert.deepEqual(
    contentImageUrls({
      driveImageUrls: [`https://drive.google.com/file/d/${id}/view`],
      images: ["https://example.com/legacy.jpg", direct],
    }),
    [direct, "https://example.com/legacy.jpg"],
  );
});
