import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGES_PER_POST,
  SUGGESTION_MAX_IMAGE_BYTES,
  imageCountError,
  imageSizeError,
  filesFromFormData,
  urlsFromFormData,
  attachmentCountError,
} from "@/lib/suggestion-image-rules";

describe("imageCountError", () => {
  test("allows none through the cap", () => {
    assert.equal(imageCountError(0), null);
    assert.equal(imageCountError(1), null);
    assert.equal(imageCountError(MAX_IMAGES_PER_POST), null);
  });

  test("refuses one past the cap", () => {
    const message = imageCountError(MAX_IMAGES_PER_POST + 1);
    assert.ok(message && message.includes(String(MAX_IMAGES_PER_POST)));
  });

  test("refuses a negative count rather than treating it as none", () => {
    assert.ok(imageCountError(-1));
  });
});

describe("imageSizeError", () => {
  test("allows exactly the cap through", () => {
    assert.equal(imageSizeError(SUGGESTION_MAX_IMAGE_BYTES), null);
  });

  test("refuses one byte over the cap", () => {
    const message = imageSizeError(SUGGESTION_MAX_IMAGE_BYTES + 1);
    assert.ok(message);
  });

  test("allows a zero-byte size through", () => {
    assert.equal(imageSizeError(0), null);
  });
});

describe("filesFromFormData", () => {
  test("returns only non-empty files under the field name", () => {
    const fd = new FormData();
    fd.append("images", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    fd.append("images", new File([], "empty.png", { type: "image/png" }));
    fd.append("other", new File([new Uint8Array([4])], "b.png", { type: "image/png" }));
    const files = filesFromFormData(fd, "images");
    assert.equal(files.length, 1);
    assert.equal(files[0].name, "a.png");
  });

  test("returns an empty array when the field is absent", () => {
    assert.deepEqual(filesFromFormData(new FormData(), "images"), []);
  });
});

describe("urlsFromFormData", () => {
  test("accepts http and https links, one per line", () => {
    const fd = new FormData();
    fd.set("imageUrls", "https://example.com/a.png\nhttp://example.com/b.jpg");
    assert.deepEqual(urlsFromFormData(fd, "imageUrls"), [
      "https://example.com/a.png",
      "http://example.com/b.jpg",
    ]);
  });

  test("drops blank lines and unparseable entries", () => {
    const fd = new FormData();
    fd.set("imageUrls", "https://example.com/a.png\n\n   \nnot a url\n");
    assert.deepEqual(urlsFromFormData(fd, "imageUrls"), ["https://example.com/a.png"]);
  });

  test("refuses non-http schemes that could reach the local machine", () => {
    const fd = new FormData();
    fd.set("imageUrls", "file:///etc/passwd\njavascript:alert(1)\ndata:image/png;base64,AAAA");
    assert.deepEqual(urlsFromFormData(fd, "imageUrls"), []);
  });

  test("returns an empty array when the field is absent", () => {
    assert.deepEqual(urlsFromFormData(new FormData(), "imageUrls"), []);
  });
});

describe("attachmentCountError", () => {
  test("counts uploads and links against the same cap", () => {
    assert.equal(attachmentCountError(2, 2), null);
    assert.ok(attachmentCountError(4, 1));
    assert.ok(attachmentCountError(3, 2));
  });

  test("allows an all-link or all-upload post up to the cap", () => {
    assert.equal(attachmentCountError(0, MAX_IMAGES_PER_POST), null);
    assert.equal(attachmentCountError(MAX_IMAGES_PER_POST, 0), null);
  });
});
