import UppyChecksum from "discourse/lib/uppy-checksum-plugin";
import { module, test } from "qunit";
import sinon from "sinon";

class FakeUppy {
  constructor() {
    this.preprocessors = [];
    this.emitted = [];
    this.files = {
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764": {
        meta: {},
        data: createFile("test1.png"),
        size: 1024,
      },
      "uppy-test/file/blah1/ads37x2/blah1/png-1d-1d-2v-1d-1e-image/jpeg-99999-1837921727764": {
        meta: {},
        data: createFile("test2.png"),
        size: 2048,
      },
      "uppy-test/file/mnb3/jfhrg43x/blah3/png-1d-1d-2v-1d-1e-image/jpeg-111111-1837921727764": {
        meta: {},
        data: createFile("test2.png"),
        size: 209715200,
      },
    };
  }

  addPreProcessor(fn) {
    this.preprocessors.push(fn);
  }

  getFile(id) {
    return this.files[id];
  }

  emit(event, file, data) {
    this.emitted.push({ event, file, data });
  }

  setFileMeta(fileId, meta) {
    this.files[fileId].meta = meta;
  }
}

module("Unit | Utility | UppyChecksum Plugin", function () {
  test("sets the options passed in", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    assert.equal(plugin.id, "uppy-checksum");
    assert.equal(plugin.capabilities, capabilities);
  });

  test("it does nothing if not running in a secure context", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    sinon.stub(plugin, "_secureContext").returns(false);

    const fileId =
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764";
    plugin.uppy.preprocessors[0]([fileId]).then(() => {
      assert.equal(
        plugin.uppy.emitted.length,
        1,
        "only the complete event was fired by the checksum plugin because it skipped the file"
      );
      done();
    });
  });

  test("it does nothing if the crypto object + cipher is not available", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    sinon.stub(plugin, "_hasCryptoCipher").returns(false);

    const fileId =
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764";
    plugin.uppy.preprocessors[0]([fileId]).then(() => {
      assert.equal(
        plugin.uppy.emitted.length,
        1,
        "only the complete event was fired by the checksum plugin because it skipped the file"
      );
      done();
    });
  });

  test("it does nothing if the browser is IE11", function (assert) {
    const capabilities = { isIE11: true };
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    const fileId =
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764";
    plugin.uppy.preprocessors[0]([fileId]).then(() => {
      assert.equal(
        plugin.uppy.emitted.length,
        1,
        "only the complete event was fired by the checksum plugin because it skipped the file"
      );
      done();
    });
  });

  test("it does nothing if the file is > 100MB", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    const fileId =
      "uppy-test/file/mnb3/jfhrg43x/blah3/png-1d-1d-2v-1d-1e-image/jpeg-111111-1837921727764";
    plugin.uppy.preprocessors[0]([fileId]).then(() => {
      assert.equal(plugin.uppy.emitted[0].event, "preprocess-progress");
      assert.equal(plugin.uppy.emitted[1].event, "preprocess-complete");
      assert.equal(plugin.uppy.getFile(fileId).meta.sha1_checksum, null);
      done();
    });
  });

  test("it gets a sha1 hash of each file and adds it to the file meta", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    const fileIds = [
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764",
      "uppy-test/file/blah1/ads37x2/blah1/png-1d-1d-2v-1d-1e-image/jpeg-99999-1837921727764",
    ];
    plugin.uppy.preprocessors[0](fileIds).then(() => {
      assert.equal(plugin.uppy.emitted[0].event, "preprocess-progress");
      assert.equal(plugin.uppy.emitted[1].event, "preprocess-progress");
      assert.equal(plugin.uppy.emitted[2].event, "preprocess-complete");
      assert.equal(plugin.uppy.emitted[3].event, "preprocess-complete");

      // these checksums are the actual SHA1 hashes of the test file names
      assert.equal(
        plugin.uppy.getFile(fileIds[0]).meta.sha1_checksum,
        "d9bafe64b034b655db018ad0226c6865300ada31"
      );
      assert.equal(
        plugin.uppy.getFile(fileIds[1]).meta.sha1_checksum,
        "cb10341e3efeab45f0bc309a1c497edca4c5a744"
      );

      done();
    });
  });

  test("it does nothing if the window.crypto.subtle.digest function throws an error / rejects", function (assert) {
    const capabilities = {};
    const fakeUppy = new FakeUppy();
    const plugin = new UppyChecksum(fakeUppy, {
      capabilities,
    });
    plugin.install();
    const done = assert.async();

    const fileIds = [
      "uppy-test/file/vv2/xvejg5w/blah/png-1d-1d-2v-1d-1e-image/jpeg-9043429-1624921727764",
      "uppy-test/file/blah1/ads37x2/blah1/png-1d-1d-2v-1d-1e-image/jpeg-99999-1837921727764",
    ];

    sinon
      .stub(window.crypto.subtle, "digest")
      .rejects({ message: "Algorithm: Unrecognized name" });

    plugin.uppy.preprocessors[0](fileIds).then(() => {
      assert.equal(plugin.uppy.emitted[0].event, "preprocess-progress");
      assert.equal(plugin.uppy.emitted[1].event, "preprocess-progress");
      assert.equal(plugin.uppy.emitted[2].event, "preprocess-complete");
      assert.equal(plugin.uppy.emitted[3].event, "preprocess-complete");

      assert.deepEqual(plugin.uppy.getFile(fileIds[0]).meta, {});
      assert.deepEqual(plugin.uppy.getFile(fileIds[1]).meta, {});

      done();
    });
  });
});

function createFile(name, type = "image/png") {
  const file = new Blob([name], {
    type,
  });
  file.name = name;
  return file;
}
