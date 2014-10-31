var OSS = require('aliyun-oss')
        , Q = require('q')
        , fs = require('fs')
        , path = require('path')
        , commander = require('commander');

var option = {
    accessKeyId: '6x6myxrb9peimhs2aof12qwe',
    accessKeySecret: 'psOj6QRG93t/8FV/Um89YSbEWt8=',
    host: 'oss-cn-hangzhou.aliyuncs.com'
};

commander.version('0.0.1')
        .option('-d, --dir [directory]', 'Local directory, default is current directory')
        .option('-o, --operation [operation]', 'Operation upload or download')
        .option('-b, --bucket [bucket]', 'The OSS bucekt name')
        .parse(process.argv);

if (!commander.bucket) {
    console.error('You must provide a BUCKET name');
    commander.help();
}

/*
 * 可选 option
 *
 * host:    default is: oss-cn-hangzhou.aliyuncs.com,
 * timeout: default is: 300000,
 * agent:   default is: agent.maxSockets = 20
 */

var oss = OSS.createClient(option);

/*
 oss.listBucket(function (err, res) {
 console.log(res.body.ListAllMyBucketsResult.Buckets[0].Bucket);
 });
 */

var bucket = commander.bucket || 'fnitest';
var destDir = commander.dir || '.';

var localDir = path.resolve(process.cwd(), destDir);

var marker = '';

function downloadFile() {
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
            maxKeys: '1000'
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
        if (keys.length === 1000) {
            marker = keys[keys.length - 1];
        } else {
            marker = '';
        }
        var promises = [];
        keys.forEach(function (key) {
            promises.push(Q(key).then(function (key) {
                var defer = Q.defer();
                var fullpath = path.join(localDir, key);
                var dir = path.dirname(fullpath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
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
}

if (commander.operation === 'download') {
    downloadFile();
}
else if (commander.operation === 'upload') {
    uploadFile();
}
