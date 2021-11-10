import Mixin from "@ember/object/mixin";
import { Promise } from "rsvp";
import { ajax } from "discourse/lib/ajax";
import AwsS3Multipart from "@uppy/aws-s3-multipart";

export default Mixin.create({
  _useS3MultipartUploads() {
    this.set("usingS3MultipartUploads", true);
    const self = this;
    const retryDelays = [0, 1000, 3000, 5000];

    this._uppyInstance.use(AwsS3Multipart, {
      // controls how many simultaneous _chunks_ are uploaded, not files,
      // which in turn controls the minimum number of chunks presigned
      // in each batch (limit / 2)
      //
      // the default, and minimum, chunk size is 5mb. we can control the
      // chunk size via getChunkSize(file), so we may want to increase
      // the chunk size for larger files
      limit: 10,
      retryDelays,

      createMultipartUpload(file) {
        self._uppyInstance.emit("create-multipart", file.id);

        const data = {
          file_name: file.name,
          file_size: file.size,
          upload_type: file.meta.upload_type,
          metadata: file.meta,
        };

        // the sha1 checksum is set by the UppyChecksum plugin, except
        // for in cases where the browser does not support the required
        // crypto mechanisms or an error occurs. it is an additional layer
        // of security, and not required.
        if (file.meta.sha1_checksum) {
          data.metadata = { "sha1-checksum": file.meta.sha1_checksum };
        }

        return ajax("/uploads/create-multipart.json", {
          type: "POST",
          data,
          // uppy is inconsistent, an error here fires the upload-error event
        }).then((responseData) => {
          self._uppyInstance.emit("create-multipart-success", file.id);

          file.meta.unique_identifier = responseData.unique_identifier;
          return {
            uploadId: responseData.external_upload_identifier,
            key: responseData.key,
          };
        });
      },

      prepareUploadParts(file, partData) {
        if (file.preparePartsRetryAttempts === undefined) {
          file.preparePartsRetryAttempts = 0;
        }
        return ajax("/uploads/batch-presign-multipart-parts.json", {
          type: "POST",
          data: {
            part_numbers: partData.partNumbers,
            unique_identifier: file.meta.unique_identifier,
          },
        })
          .then((data) => {
            if (file.preparePartsRetryAttempts) {
              delete file.preparePartsRetryAttempts;
              self._consoleDebug(
                `[uppy] Retrying batch fetch for ${file.id} was successful, continuing.`
              );
            }
            return { presignedUrls: data.presigned_urls };
          })
          .catch((err) => {
            const status = err.jqXHR.status;

            // it is kind of ugly to have to track the retry attempts for
            // the file based on the retry delays, but uppy's `retryable`
            // function expects the rejected Promise data to be structured
            // _just so_, and provides no interface for us to tell how many
            // times the upload has been retried (which it tracks internally)
            //
            // if we exceed the attempts then there is no way that uppy will
            // retry the upload once again, so in that case the alert can
            // be safely shown to the user that their upload has failed.
            if (file.preparePartsRetryAttempts < retryDelays.length) {
              file.preparePartsRetryAttempts += 1;
              const attemptsLeft =
                retryDelays.length - file.preparePartsRetryAttempts + 1;
              self._consoleDebug(
                `[uppy] Fetching a batch of upload part URLs for ${file.id} failed with status ${status}, retrying ${attemptsLeft} more times...`
              );
              return Promise.reject({ source: { status } });
            } else {
              self._consoleDebug(
                `[uppy] Fetching a batch of upload part URLs for ${file.id} failed too many times, throwing error.`
              );
              // uppy is inconsistent, an error here does not fire the upload-error event
              self._handleUploadError(file, err);
            }
          });
      },

      completeMultipartUpload(file, data) {
        self._uppyInstance.emit("complete-multipart", file.id);
        const parts = data.parts.map((part) => {
          return { part_number: part.PartNumber, etag: part.ETag };
        });
        return ajax("/uploads/complete-multipart.json", {
          type: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            parts,
            unique_identifier: file.meta.unique_identifier,
            pasted: file.meta.pasted,
            for_private_message: file.meta.for_private_message,
          }),
          // uppy is inconsistent, an error here fires the upload-error event
        }).then((responseData) => {
          self._uppyInstance.emit("complete-multipart-success", file.id);
          return responseData;
        });
      },

      abortMultipartUpload(file, { key, uploadId }) {
        // if the user cancels the upload before the key and uploadId
        // are stored from the createMultipartUpload response then they
        // will not be set, and we don't have to abort the upload because
        // it will not exist yet
        if (!key || !uploadId) {
          return;
        }

        // this gives us a chance to inspect the upload stub before
        // it is deleted from external storage by aborting the multipart
        // upload; see also ExternalUploadManager
        if (file.meta.error && self.siteSettings.enable_upload_debug_mode) {
          return;
        }

        return ajax("/uploads/abort-multipart.json", {
          type: "POST",
          data: {
            external_upload_identifier: uploadId,
          },
          // uppy is inconsistent, an error here does not fire the upload-error event
        }).catch((err) => {
          self._handleUploadError(file, err);
        });
      },

      // we will need a listParts function at some point when we want to
      // resume multipart uploads; this is used by uppy to figure out
      // what parts are uploaded and which still need to be
    });
  },
});
