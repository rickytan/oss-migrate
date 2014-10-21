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


var bucket = 'fnitest';
var destDir = './';

var localDir = path.resolve(__dirname, destDir);

Q.fcall(function() {
	var defer = Q.defer();
/*
 * prefix:    可选，object 前缀
 * marker:    可选，列表起始object
 * delimiter: 可选，object分组字符，若'/'为则不列出路径深度大于等于二层的object。
 * maxKeys:   可选，列出的object最大个数
 */
	oss.listObject({
	  bucket: bucket,
	  prefix: '',
	  marker: '',
	  delimiter: '',
	  maxKeys: ''
	}, function (err, res) {
		if (err) defer.reject(err);
		else defer.resolve(res.body.ListBucketResult.Contents);
	});
	return defer.promise;
}).then(function(objects) {
	return objects.map(function(o) {
		return o.Key[0];
	});
}).then(function(keys) {
	var promises = [];
	keys.forEach(function(key) {
		promises.push(Q(key).then(function(key) {
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
			}, function(err, res) {
				if (err) defer.reject(err);
				else defer.resolve(res);
			});
			return defer.promise;
		}), function(e) {
			console.log(e);
		});
	});
	return Q.all(promises);
}).catch(function(e) {
	console.log(e);
}).done();