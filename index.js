var OSS = require('aliyun-oss')
        , Q = require('q')
        , fs = require('fs')
        , path = require('path')
        , commander = require('commander');

/*
 * 可选 option
 *
 * host:    default is: oss-cn-hangzhou.aliyuncs.com,
 * timeout: default is: 300000,
 * agent:   default is: agent.maxSockets = 20
 */
var option = require("./config.json");
if (!option.accessKeyId) {
    console.error("Please mofidy config.json with your requirement!");
    process.exit();
}

commander.version('0.0.1')
        .command('download <bucket> <dir>')
        .action(function (bucket, dir) {
            var oss = OSS.createClient(option);
            bucket = 'fnitest';

            var localDir = path.resolve(process.cwd(), dir);
            var marker = '';

            Q.fcall(function () {
                var defer = Q.defer();
                /**
                 * prefix:    可选，object 前缀
                 * marker:    可选，列表起始object
                 * delimiter: 可选，object分组字符，若'/'为则不列出路径深度大于等于二层的object。
                 * maxKeys:   可选，列出的object最大个数
                 */

                oss.listObject({
                    bucket: bucket,
                    prefix: '',
                    marker: marker,
                    delimiter: '',
                    maxKeys: '1000' // 每次最多返回 1000 个
                }, function (err, res) {
                    if (err)
                        defer.reject(err);
                    else
                        defer.resolve(res.body.ListBucketResult.Contents);
                });
                return defer.promise;
            }).then(function (objects) {
                return objects.map(function (o) {
                    return o.Key[0];
                });
            }).then(function (keys) {
                // 返回 1000 个说明可能还有更多
                if (keys.length === 1000) {
                    marker = keys[keys.length - 1];
                } else {
                    marker = '';
                }

                function mkdirp(dirpath) {
                    if (fs.existsSync(dirpath))
                        return;
                    var components = dirpath.split(path.sep);
                    if (components.length) {
                        components.pop();
                        mkdirp(components.join(path.sep));
                        fs.mkdirSync(dirpath);
                    }
                }
                var promises = [];
                keys.forEach(function (key) {
                    promises.push(Q(key).then(function (key) {
                        var defer = Q.defer();
                        var fullpath = path.join(localDir, key);
                        var dir = path.dirname(fullpath);
                        mkdirp(dir);
                        var stat = fs.statSync(dir);
                        if (!stat.isDirectory()) {
                            fs.rmdirSync(dir);
                            fs.mkdirSync(dir);
                        }
                        return [key, fullpath];
                    }).spread(function (key, fullpath) {
                        var defer = Q.defer();
                        console.log("Downloading %s", key);
                        oss.getObject({
                            bucket: bucket,
                            object: key,
                            dest: fullpath,
                            headers: {}
                        }, function (err, res) {
                            if (err)
                                defer.reject(err);
                            else
                                defer.resolve(res);
                        });
                        return defer.promise;
                    }), function (e) {
                        console.log(e);
                    });
                });
                return Q.all(promises);
            }).catch(function (e) {
                console.log(e);
            }).done(function () {
                if (marker.length > 0) {
                    downloadFile();
                } else {
                    console.log("Done!");
                }
            });
        });

commander.command('upload <dir> <bucket>')
        .action(function (dir, bucket) {
            var OssEasy = require('oss-easy');
            var oss = new OssEasy(option, bucket);

            var localDir = path.resolve(process.cwd(), dir);
            var marker = '';

            var promises = [];
            require('filewalker')(localDir).on('dir', function (dirpath) {
                //console.log(path);
                //return false;
            }).on('file', function (filepath, size) {
                var parts = filepath.split(path.sep);
                var skip = false;   // skip hidden files
                parts.forEach(function (part) {
                    if (part[0] === '.')
                        skip = true;
                });
                if (!skip) {
                    console.log("Uploading %s", filepath);
                    var defer = Q.defer();
                    
                    oss.uploadFile(path.join(localDir, filepath), filepath, function(err) {
                        if (err)
                            defer.reject(err);
                        else
                            defer.resolve();
                    });
                    promises.push(defer.promise);
                }
            }).on('done', function () {
                console.log('File traveser done!');
                Q.all(promises).catch(function (e) {
                    console.log(e);
                }).done(function () {

                });
            }).walk();
        });

commander.parse(process.argv);

/*
 oss.listBucket(function (err, res) {
 console.log(res.body.ListAllMyBucketsResult.Buckets[0].Bucket);
 });
 */

