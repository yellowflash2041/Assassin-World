import {
  lookupCachedUploadUrl,
  resolveAllShortUrls,
  resetCache
} from "pretty-text/upload-short-url";
import { ajax } from "discourse/lib/ajax";
import { fixture } from "helpers/qunit-helpers";
import pretender from "helpers/create-pretender";

QUnit.module("lib:pretty-text/upload-short-url", {
  beforeEach() {
    const response = object => {
      return [200, { "Content-Type": "application/json" }, object];
    };

    const imageSrcs = [
      {
        short_url: "upload://a.jpeg",
        url: "/uploads/default/original/3X/c/b/1.jpeg",
        short_path: "/uploads/short-url/a.jpeg"
      },
      {
        short_url: "upload://b.jpeg",
        url: "/uploads/default/original/3X/c/b/2.jpeg",
        short_path: "/uploads/short-url/b.jpeg"
      },
      {
        short_url: "upload://z.jpeg",
        url: "/uploads/default/original/3X/c/b/9.jpeg",
        short_path: "/uploads/short-url/z.jpeg"
      }
    ];

    const attachmentSrcs = [
      {
        short_url: "upload://c.pdf",
        url: "/uploads/default/original/3X/c/b/3.pdf",
        short_path: "/uploads/short-url/c.pdf"
      }
    ];

    const otherMediaSrcs = [
      {
        short_url: "upload://d.mp4",
        url: "/uploads/default/original/3X/c/b/4.mp4",
        short_path: "/uploads/short-url/d.mp4"
      },
      {
        short_url: "upload://e.mp3",
        url: "/uploads/default/original/3X/c/b/5.mp3",
        short_path: "/uploads/short-url/e.mp3"
      }
    ];

    pretender.post("/uploads/lookup-urls", () => {
      return response(imageSrcs.concat(attachmentSrcs.concat(otherMediaSrcs)));
    });

    fixture().html(
      imageSrcs.map(src => `<img data-orig-src="${src.url}">`).join("") +
        attachmentSrcs.map(src => `<a data-orig-href="${src.url}">`).join("") +
        `<div class="scoped-area"><img data-orig-src="${imageSrcs[2].url}"></div>`
    );
  },

  afterEach() {
    resetCache();
  }
});

QUnit.test("resolveAllShortUrls", async assert => {
  let lookup;

  lookup = lookupCachedUploadUrl("upload://a.jpeg");
  assert.deepEqual(lookup, {});

  await resolveAllShortUrls(ajax);

  lookup = lookupCachedUploadUrl("upload://a.jpeg");

  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/1.jpeg",
    short_path: "/uploads/short-url/a.jpeg"
  });

  lookup = lookupCachedUploadUrl("upload://b.jpeg");

  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/2.jpeg",
    short_path: "/uploads/short-url/b.jpeg"
  });

  lookup = lookupCachedUploadUrl("upload://c.jpeg");
  assert.deepEqual(lookup, {});

  lookup = lookupCachedUploadUrl("upload://c.pdf");
  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/3.pdf",
    short_path: "/uploads/short-url/c.pdf"
  });

  lookup = lookupCachedUploadUrl("upload://d.mp4");
  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/4.mp4",
    short_path: "/uploads/short-url/d.mp4"
  });

  lookup = lookupCachedUploadUrl("upload://e.mp3");
  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/5.mp3",
    short_path: "/uploads/short-url/e.mp3"
  });
});

QUnit.test("resolveAllShortUrls - scoped", async assert => {
  let lookup;
  await resolveAllShortUrls(ajax, ".scoped-area");

  lookup = lookupCachedUploadUrl("upload://z.jpeg");

  assert.deepEqual(lookup, {
    url: "/uploads/default/original/3X/c/b/9.jpeg",
    short_path: "/uploads/short-url/z.jpeg"
  });

  // do this because the pretender caches ALL the urls, not
  // just the ones being looked up (like the normal behaviour)
  resetCache();
  await resolveAllShortUrls(ajax, ".scoped-area");

  lookup = lookupCachedUploadUrl("upload://a.jpeg");
  assert.deepEqual(lookup, {});
});
