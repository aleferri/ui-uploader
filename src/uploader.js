/*!
 * angular-ui-uploader
 * https://github.com/aleferri/ui-uploader
 * Version: 1.5.0 - 2023-04-20T06:14:06.100Z
 * License: MIT
 */


(function () {
    'use strict';
    /*
     * Author: Remy Alain Ticona Carbajal http://realtica.org
     * Description: The main objective of ng-uploader is to have a user control,
     * clean, simple, customizable, and above all very easy to implement.
     * Licence: MIT
     */

    const FRAGMENT_256KB_SIZE = 262144;

    angular.module('ui.uploader', []).service('uiUploader', uiUploader);

    uiUploader.$inject = ['$log'];

    const instance = function (options, $log, uniqueId) {
        /*jshint validthis: true */
        const self = this;

        self.uniqueId = uniqueId;
        self.files = [];
        self.options = options;
        self.activeUploads = 0;
        self.uploadedFiles = 0;

        self.options.concurrency = parseInt(self.options.concurrency || 1);

        $log.info('uiUploader loaded');

        function addLocalFiles(files) {
            for (let i = 0; i < files.length; i++) {
                const file = {
                    input: files[i],
                    name: files[i].name,
                    title: '',
                    url: null,
                    size: files[i].size,
                    formattedSize: formatSize(files[i].size),
                    id: null,
                    index: self.files.length,
                    uploadedSize: 0,
                    loaded: 0,
                    percent: 0,
                    inUpload: false,
                    readyToUpload: true,
                    isOnServer: false
                };

                self.files.push(file);
            }
        }

        function addRemoteFiles(files) {
            for (let i = 0; i < files.length; i++) {
                const file = {
                    input: null,
                    name: files[i].title,
                    title: files[i].title,
                    url: files[i].url,
                    size: files[i].size,
                    formattedSize: formatSize(files[i].size),
                    id: files[i].id,
                    index: self.files.length,
                    uploadedSize: 0,
                    loaded: 0,
                    inUpload: false,
                    readyToUpload: false,
                    isOnServer: true
                };

                self.files.push(file);
            }
        }

        function getFiles() {
            return self.files;
        }

        function startUpload() {

            //headers are not shared by requests
            const headers = options.headers || {};
            const xhrOptions = options.options || {};

            for (const file of self.files) {
                if (self.activeUploads === self.options.concurrency) {
                    break;
                }

                if (file.readyToUpload) {
                    uploadFile(file, self.options.uploadUrl, self.options.data, self.options.paramName, headers, xhrOptions);
                }
            }
        }

        function dropFile(index) {
            self.files.splice(index, 1);

            let i = 0;
            for (const file of self.files) {
                file.index = i;
                i++;
            }
        }

        function onUploadProgress(file, event) {
            if (!event.lengthComputable) {
                return;
            }

            if (file.loaded + event.loaded > file.size) {
                file.size = file.loaded + event.loaded;
                file.formattedSize = formatSize(file.size);
                console.log('File is bigger');
            }

            file.loaded += event.loaded;
            file.uploadedSize = formatSize(file.loaded);

            if (angular.isFunction(self.options.onProgress)) {
                self.options.onProgress(file);
            }
            
            self.options.$apply();
        }

        function formatSize(bytes) {
            const sizes = ['n/a', 'bytes', 'KiB', 'MiB', 'GiB', 'TB', 'PB', 'EiB', 'ZiB', 'YiB'];
            const i = (bytes === 0) ? 0 : +Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + sizes[isNaN(bytes) ? 0 : i + 1];
        }
        
        function syncRemoteFile(file) {
            //headers are not shared by requests
            const headers = options.headers || {};
            const xhrOptions = options.options || {};
            
            saveDataAjax(file, options.editUrl, headers, xhrOptions);
        }
        
        function saveDataAjax(file, url, headers, xhrOptions) {
            const xhr = new window.XMLHttpRequest();

            // To account for sites that may require CORS
            if (xhrOptions.withCredentials === true) {
                xhr.withCredentials = true;
            }

            if (headers) {
                for (let headerKey in headers) {
                    if (headers.hasOwnProperty(headerKey)) {
                        xhr.setRequestHeader(headerKey, headers[headerKey]);
                    }
                }
            }

            // Triggered when the upload has completed AND the server has responded. Equivalent to
            // listening for the readystatechange event when xhr.readyState === XMLHttpRequest.DONE.
            xhr.onload = function () {
                if (angular.isFunction(self.options.onFileSaved)) {
                    self.options.onFileSaved(file, xhr.responseText, xhr.status);
                }
            };
            
            let data = {};
            
            if (angular.isFunction(self.options.beforeFileSave)) {
                data = self.options.beforeFileSave(data, file);
            }
            
            const formData = new FormData();
            formData.append('fileId', file.id);
            
            // Append additional data if provided:
            if (data) {
                for (let prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        formData.append(prop, data[prop]);
                    }
                }
            }

            // Initiate upload:
            xhr.open('POST', url);
            xhr.send(formData);

            return xhr;
        }
        
        function dropRemoteFile(file) {
            //headers are not shared by requests
            const headers = options.headers || {};
            const xhrOptions = options.options || {};
            
            dropAjax(file, options.deleteUrl, headers, xhrOptions);
        }

        function dropAjax(file, url, headers, xhrOptions) {
            const xhr = new window.XMLHttpRequest();

            // To account for sites that may require CORS
            if (xhrOptions.withCredentials === true) {
                xhr.withCredentials = true;
            }

            if (url.includes('?')) {
                url += '&';
            } else {
                url += '?';
            }

            if (headers) {
                for (let headerKey in headers) {
                    if (headers.hasOwnProperty(headerKey)) {
                        xhr.setRequestHeader(headerKey, headers[headerKey]);
                    }
                }
            }

            // Triggered when the upload has completed AND the server has responded. Equivalent to
            // listening for the readystatechange event when xhr.readyState === XMLHttpRequest.DONE.
            xhr.onload = function () {
                if (angular.isFunction(self.options.onFileDeleted)) {
                    self.options.onDeleted(file, xhr.responseText, xhr.status);
                }
            };
            
            let data = null;
            
            if (angular.isFunction(self.options.beforeFileDelete)) {
                data = self.options.beforeFileDelete(data, file);
            }
            
            const formData = new FormData();
            formData.append('fileId', file.id);
            
            // Append additional data if provided:
            if (data) {
                for (let prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        formData.append(prop, data[prop]);
                    }
                }
            }

            // Initiate upload:
            xhr.open('POST', url);
            xhr.send(formData);

            return xhr;
        }

        function uploadFile(file, uri, data, key, headers, xhrOptions) {
            const fragments = Math.ceil(file.size / FRAGMENT_256KB_SIZE);
            console.log('Number of fragments for', file.name, fragments);

            file.loaded = 0;
            file.inUpload = true;
            file.readyToUpload = false;
            self.activeUploads += 1;

            if (angular.isFunction(self.options.beforeFileUpload)) {
                data = self.options.beforeFileUpload(data, file);
            }

            uploadAjax(file, 0, uri, data, key, headers, xhrOptions);
        }

        function uploadAjax(file, fragment, url, data, key, headers, xhrOptions) {
            data = data || {};
            key = key || 'file';

            const xhr = new window.XMLHttpRequest();

            // To account for sites that may require CORS
            if (xhrOptions.withCredentials === true) {
                xhr.withCredentials = true;
            }

            const startOffset = Math.min(fragment * FRAGMENT_256KB_SIZE, file.size);
            const endOffset = Math.min(startOffset + FRAGMENT_256KB_SIZE, file.size);
            const chunk = file.input.slice(startOffset, endOffset);

            const formData = new window.FormData();

            if (fragment === 0) {
                formData.append('fileInit', true);
            }

            const isLast = (endOffset === file.size);

            formData.append('fileLastFragment', isLast);
            formData.append('fileFragmentNum', fragment);

            xhr.open('POST', url);

            if (headers) {
                for (const headerKey in headers) {
                    if (headers.hasOwnProperty(headerKey)) {
                        xhr.setRequestHeader(headerKey, headers[headerKey]);
                    }
                }
            }

            // Triggered when upload starts:
            xhr.upload.onloadstart = function () {};

            // Triggered many times during upload:
            xhr.upload.onprogress = onUploadProgress.bind(self, file);

            // Triggered when the upload is successful (the server may not have responded yet).
            xhr.upload.onload = function () {
                if (angular.isFunction(self.options.onUploadSuccess)) {
                    self.options.onUploadSuccess(file, fragment);
                }
            };

            // Triggered when upload fails:
            xhr.upload.onerror = function (e) {
                file.inUpload = false;
                file.readyToUpload = true;

                if (angular.isFunction(self.options.onError)) {
                    self.options.onError(e);
                }
            };

            // Triggered when the upload has completed AND the server has responded. Equivalent to
            // listening for the readystatechange event when xhr.readyState === XMLHttpRequest.DONE.
            xhr.onload = function () {
                console.log(file);

                if (!isLast) {
                    uploadAjax(file, fragment + 1, url, data, key, headers, xhrOptions);
                    return;
                }

                const response = JSON.parse(xhr.response);

                file.url = response.url;
                file.id = response.id;
                file.isOnServer = true;
                file.inUpload = false;
                file.uploaded = true;

                self.activeUploads -= 1;
                self.uploadedFiles += 1;

                startUpload(self.options);

                if (angular.isFunction(self.options.onCompleted)) {
                    self.options.onCompleted(file, xhr.responseText, xhr.status);
                }

                if (self.activeUploads === 0) {
                    self.uploadedFiles = 0;
                    if (angular.isFunction(self.options.onCompletedAll)) {
                        self.options.onCompletedAll(self.files);
                    }
                }
                
                self.options.$apply();
            };

            // Append additional data if provided:
            if (data) {
                for (let prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        formData.append(prop, data[prop]);
                    }
                }
            }

            // Append file data:
            formData.append(key, chunk, file.name);

            // Initiate upload:
            xhr.send(formData);

            return xhr;
        }
        
        return {
            addLocalFiles: addLocalFiles,
            addRemoteFiles: addRemoteFiles,
            getFiles: getFiles,
            startUpload: startUpload,
            dropFile: dropFile,
            dropRemoteFile: dropRemoteFile,
            syncRemoteFile: syncRemoteFile,
            files: self.files,
            uniqueId: self.uniqueId
        };
    };

    function uiUploader($log) {

        let id = 0;

        return {
            getInstance: function (options) {
                const nextId = id;
                id++;
                return new instance(options || {}, $log, 'uploader-file-' + nextId);
            }
        };

    }
}());