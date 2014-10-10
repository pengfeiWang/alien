/*!
 * hashbang.js
 * @author ydr.me
 * 2014-09-24 14:50
 */


define(function (require, exports, module) {
    /**
     * URL 的 hash 部分解析与设置<br>
     * 支持的 hashbang 格式为<code>#!/foo/bar/?a=1&b=2&b=3</code><br>
     * 必须以<code>#!</code>开头，后续的 querystring 必须符合标准
     *
     * @module core/navigator/hashbang
     * @requires util/data
     * @requires core/navigator/querystring
     * @requires core/event/base
     */
    'use strict';

    var data = require('../../util/data.js');
    var qs = require('./querystring.js');
    var event = require('../event/base.js');
//    var udf;
    var regHash = /#.*$/;
    var regHashbang = /^#!\//;
    var regColon = /:([^\/]+)/g;
    var regEndSlash = /\/$/;
    var regSep = /\//g;
    var pathListenerMap = {};
    var pathAllListener = [];
    var queryListenerMap = {};
    var queryAllListener = [];
    var matchesDefaults = {
        // 是否忽略大小写，默认 false
        isIgnoreCase: !1,
        // 是否忽略末尾斜杠，默认 true
        isIgnoreEndSlash: !0
    };
    var hashbang = module.exports = {
        /**
         * 解析 hashbang 字符串为对象
         * @static
         * @param {String} hashbangString 原始字符串或URL
         * @param {String} [sep] query 部分分隔符，默认`&`
         * @param {String} [eq] query 部分等于符，默认`=`
         * @returns {Object} 包含`path`和`query`两个字段
         *
         * @example
         * hashbang.parse('#!/a/b/c?a=1&b=2');
         * // => {
         * //    path: ["a", "b", "c"],
         * //    query: {
         * //        a: "1",
         * //        b: "2"
         * //    }
         * // }
         */
        parse: function (hashbangString, sep, eq) {
            if (data.type(hashbangString) !== 'string') {
                return {};
            }

            hashbangString = (hashbangString.match(regHash) || [''])[0];

            if (!regHashbang.test(hashbangString)) {
                return {};
            }

            sep = sep || '&';
            eq = eq || '=';

            // #!/a/b/c/d/?a=1&b=2&c=3
            var hashbangGroup = hashbangString.replace(regHashbang, '/').split('#')[0];
            var hashGroup = hashbangGroup.split('?');
            var hashPathStack = [];

            data.each(hashGroup[0].split('/'), function (index, item) {
                item = _decode(item);
                if (item.length) {
                    hashPathStack.push(_decode(item));
                }
            });

            return {
                path: hashPathStack,
                query: qs.parse(hashGroup[1], sep, eq)
            };
        },

        /**
         * 将 hashbang 对象字符化
         * @param {Object} hashbangObject 对象，包含`path`和`query`两个字段
         * @param {String} [sep] query 部分分隔符，默认`&`
         * @param {String} [eq] query 部分等于符，默认`=`
         * @returns {string} hashbang 字符串
         *
         * @example
         * hashbang.stringify({
         *    path: ["a", "b", "c"],
         *    query: {
         *       a: 1,
         *       b: 2,
         *       c: 3
         *    }
         * });
         * // => "#!/a/b/c/?a=1&b=2&c=3"
         */
        stringify: function (hashbangObject, sep, eq) {
            sep = sep || '&';
            eq = eq || '=';
            hashbangObject.path = hashbangObject.path || [];
            hashbangObject.query = hashbangObject.query || {};

            var hashPath = [];
            var hashQuerystring = qs.stringify(hashbangObject.query, sep, eq);

            if (data.type(hashbangObject.path) === 'string') {
                return '#!' + hashbangObject.path +
                    (hashQuerystring ? '?' + hashQuerystring : '');
            }

            data.each(hashbangObject.path, function (index, path) {
                hashPath.push(_encode(path));
            });

            return '#!' + (hashPath.length ? '/' + hashPath.join('/') : '') + '/' +
                (hashQuerystring ? '?' + hashQuerystring : '');
        },

        /**
         * 匹配 URL path 部分
         * @param {String} hashbangString hash 字符串
         * @param {String} route 正怎字符串
         * @param {Object} [options] 参数配置
         * @param {Object} [options.isIgnoreCase] 是否忽略大小写，默认 false
         * @param {Object} [options.isIgnoreEndSlash] 是否忽略末尾斜杠，默认 true
         * @returns {*}
         *
         * @example
         * hashbang.matches('#!/id/abc123/', '/id/:id/');
         * // => {
         * //     params: {
         * //        id: "abc123"
         * //     },
         * //     route: "/id/:id/"
         * // }
         *
         * hashbang.matches('#!/name/abc123/', '/id/:id/');
         * // => null
         */
        matches: function (hashbangString, route, options) {
            // /id/:id/ => /id/abc123/   √

            options = data.extend({}, matchesDefaults, options);

            var temp;
            var keys = [0];
            var matched;
            var routeSource = route;
            var reg;
            var ret = null;

            if (data.type(hashbangString) !== 'string') {
                return ret;
            }

            temp = hashbangString.split('#');
            temp.shift();
            hashbangString = '#' + temp.join('');
            hashbangString = '/' + hashbangString.replace(regHashbang, '').split('?')[0];


            if (options.isIgnoreEndSlash) {
                route += regEndSlash.test(route) ? '?' : '/?';
            }

            route = route.replace(regColon, '([^/]+)').replace(regSep, '\\/');
            reg = new RegExp('^' + route + '$', options.isIgnoreCase ? 'i' : '');

            while ((matched = regColon.exec(routeSource)) !== null) {
                keys.push(matched[1]);
            }

            matched = hashbangString.match(reg);

            if (!matched) {
                return ret;
            }

            data.each(keys, function (index, key) {
                if (index && matched[index]) {
                    ret = ret || {};
                    ret[key] = matched[index];
                }
            });

            return {
                route: routeSource,
                params: ret
            };
        },

//        /**
//         * 设置当前 hashbang
//         * @param {String} part 设置部分，分别为`path`或`query`
//         * @param {String} key 设置键、键值对
//         * @param {String} [val] 键值
//         *
//         * @example
//         * // path
//         * hashbang.set('path', 0, 'a');
//         * hashbang.set('path', ['b', 'c']);
//         *
//         * // query
//         * hashbang.set('query', 'a', 1);
//         * hashbang.set('query', {
//         *     a: 2,
//         *     b: 3
//         * });
//         */
//        set: function (part, key, val) {
//            if (!_isSafePart(part)) {
//                throw new Error('hashbang `part` must be `path` or `query`');
//            }
//
//            var parse = this.parse(location.hash);
//            var map;
//            var keyType = data.type(key);
//            var valType = _isSafeVal(val);
//            var maxPathLength;
//
//            if (part === 'query') {
//                if (keyType === 'string' && valType === true || keyType === 'object') {
//                    if (keyType === 'object') {
//                        map = key;
//                    } else {
//                        map = {};
//                        map[key] = val;
//                    }
//
//                    parse.query = data.extend({}, parse.query, map);
//                } else {
//                    throw new Error('`key` must be a object or `key` must b a string, ' +
//                        '`val` must be a string/number/boolean');
//                }
//            } else {
//                if (keyType === 'number' && valType === true || keyType === 'array') {
//                    if (keyType === 'array') {
//                        map = key;
//                    } else {
//                        map = [];
//                        map[key] = val;
//                    }
//
//                    maxPathLength = parse.path.length + 1;
//
//                    if (map.length > maxPathLength) {
//                        throw new Error('set path array length must lt ' + maxPathLength);
//                    }
//
//                    parse.path = data.extend({}, parse.path, map);
//
//                } else {
//                    throw new Error('`key` must be a object or `key` must b a string, ' +
//                        '`val` must be a string/number/boolean');
//                }
//            }
//
//            location.hash = this.stringify(parse);
//        },
//
//        /**
//         * 移除键值
//         * @param {String} part 可以为`path`或`query`
//         * @param {Array|String|Number} key 移除键
//         *
//         * @example
//         * // path
//         * hashbang.remove('path', 0);
//         * hashbang.remove('path', [0, 1]);
//         *
//         * // query
//         * hashbang.remove('query', 'a');
//         * hashbang.remove('query', ['a', 'b']);
//         */
//        remove: function (part, key) {
//            if (!_isSafePart(part)) {
//                throw new Error('hashbang `part` must be `path` or `query`');
//            }
//
//            var keyType = data.type(key);
//            var removeKeys = [];
//            var parse = this.parse(location.hash);
//
//            if (part === 'path') {
//                if (keyType === 'array') {
//                    removeKeys = key;
//                } else {
//                    removeKeys.push(key);
//                }
//
//                data.each(removeKeys, function (index, key) {
//                    if (data.type(key) === 'number') {
//                        parse.path.splice(key - index, 1);
//                    }
//                });
//            } else {
//                if (keyType === 'array') {
//                    removeKeys = key;
//                } else {
//                    removeKeys.push(key);
//                }
//
//                data.each(removeKeys, function (index, key) {
//                    if (data.type(key) === 'string') {
//                        delete(parse.query[key]);
//                    }
//                });
//            }
//
//            location.hash = this.stringify(parse);
//        },
//
//        /**
//         * 获取 hashbang 的键值
//         * @param {String} [part] 获取部分，分别为`path`或`query`，为空表示获取全部解析
//         * @param {Number|String} [key] 键，为空表示返回该部分全部解析
//         * @returns {Object|String|undefined} 返回值
//         *
//         * @example
//         * // all
//         * hashbang.get();
//         * // => {path: ["b", "c"], query: {a:"2", b: "3"}}
//         *
//         * // path
//         * hashbang.get('path');
//         * // => ["b", "c"]
//         * hashbang.get('path', 0);
//         * // => "b"
//         *
//         * // query
//         * hashbang.get('query');
//         * // => {a:"2", b: "3"}
//         * hashbang.get('query', 'a');
//         * // => "2"
//         */
//        get: function (part, key) {
//            var keyType = data.type(key);
//            var argL = arguments.length;
//            var parse = this.parse(location.hash);
//
//            if (argL === 0) {
//                return parse;
//            }
//
//            if (!_isSafePart(part)) {
//                throw new Error('hashbang `part` must be `path` or `query`');
//            }
//
//            if (argL === 1) {
//                return parse[part];
//            } else if (argL === 2 && (part === 'path' && keyType === 'number' || part === 'query' && keyType === 'string')) {
//                return parse[part][key];
//            } else {
//                throw new Error('`path` key must be a number, `query` key must be a string');
//            }
//        },

        /**
         * 监听 hashbang
         * @param {String} part 监听部分，可以为`query`或`path`
         * @param {String|Number|Array|Function} [key] 监听的键，`query`为字符串，`path`为数值，多个键使用数组表示
         * @param {Function} listener 监听回调
         *
         * @example
         * // pathc
         * hashbang.on('path', fn);
         * hashbang.on('path', 0, fn);
         *
         * // query
         * hashbang.on('query', fn);
         * hashbang.on('query', 'abc', fn);
         */
        on: function (part, key, listener) {
            if (!_isSafePart(part)) {
                throw new Error('hashbang `part` must be `path` or `query`');
            }

            var args = arguments;
            var argL = args.length;
            var listenerMap;

            if (argL === 2) {
                listener = args[1];

                if (data.type(listener) === 'function') {
                    if (part === 'query') {
                        queryAllListener.push(listener);
                    } else {
                        pathAllListener.push(listener);
                    }
                }
            } else if (argL === 3) {
                listenerMap = part === 'query' ? queryListenerMap : pathListenerMap;

                if (data.type(key) !== 'array') {
                    key = [key];
                }

                data.each(key, function (index, k) {
                    listenerMap[k] = listenerMap[k] || [];

                    if (data.type(listener) === 'function') {
                        listenerMap[k].push(listener);
                    }
                });
            }
        },

        /**
         * 移除监听 hashbang
         * @param {String} part 监听部分，可以为`query`或`path`
         * @param {String|Number|Array|Function} [key] 监听的键，`query`为字符串，`path`为数值，多个键使用数组表示
         * @param {Function} [listener] 监听回调，回调为空表示删除该键的所有监听队列
         *
         * @example
         * // path
         * // 移除 path 0字段上的一个监听
         * hashbang.un('path', 0, fn);
         * // 移除 path 0字段上的所有监听
         * hashbang.un('path', 0);
         * // 移除 path 所有字段的一个监听
         * hashbang.un('path', fn);
         * // 移除 path 所有字段的所有监听
         * hashbang.un('path');
         *
         * // query
         * // 移除 query abc 键上的一个监听
         * hashbang.un('query', 'abc', fn);
         * // 移除 query abc 键上的所有监听
         * hashbang.un('query', 'abc');
         * // 移除 query 所有键上的一个监听
         * hashbang.un('query', fn);
         * // 移除 query 所有键上的所有监听
         * hashbang.un('query');
         */
        un: function (part, key, listener) {
            if (!_isSafePart(part)) {
                throw new Error('hashbang `part` must be `path` or `query`');
            }

            var args = arguments;
            var argL = args.length;
            var findIndex;
            var arg1Type = data.type(args[1]);
            var arg2Type = data.type(args[2]);
            var listenerMap = part === 'query' ? queryListenerMap : pathListenerMap;

            if (argL === 1) {
                if (part === 'query') {
                    queryAllListener = [];
                } else {
                    pathAllListener = [];
                }
            } else if (argL === 2 && arg1Type === 'function') {
                listener = args[1];
                listenerMap = part === 'query' ? queryAllListener : pathAllListener;

                findIndex = listenerMap.indexOf(listener);

                if (findIndex > -1) {
                    listenerMap.splice(findIndex, 1);
                }
            } else if (argL === 2 && (arg1Type === 'string' || arg1Type === 'array')) {
                key = arg1Type === 'array' ? key : [key];

                data.each(key, function (index, k) {
                    listenerMap[k] = [];
                });
            } else if (argL === 3 && (arg1Type === 'string' || arg1Type === 'array') && arg2Type === 'function') {
                key = arg1Type === 'array' ? key : [key];

                data.each(key, function (index, k) {
                    var findIndex = listenerMap.indexOf(listener);

                    if (findIndex > -1) {
                        listenerMap[k].splice(findIndex, 1);
                    }
                });
            }
        }
    };

    event.on(window, 'hashchange', function (eve) {
        var newObject = hashbang.parse(eve.newURL);
        var oldObject = hashbang.parse(eve.oldURL);
        var pathDifferentKeys = _differentKeys(newObject.path, oldObject.path);
        var queryDifferentKeys = _differentKeys(newObject.query, oldObject.query);
        var args = [eve, newObject, oldObject];

        if (pathDifferentKeys.length) {
            data.each(pathAllListener, function (i, listener) {
                listener.apply(window, args);
            });
        }

        data.each(pathDifferentKeys, function (i, key) {
            if (pathListenerMap[key]) {
                data.each(pathListenerMap[key], function (j, listener) {
                    listener.apply(window, args);
                });
            }
        });

        if (queryDifferentKeys.length) {
            data.each(queryAllListener, function (i, listener) {
                listener.apply(window, args);
            });
        }

        data.each(queryDifferentKeys, function (i, key) {
            if (queryListenerMap[key]) {
                data.each(queryListenerMap[key], function (j, listener) {
                    listener.apply(window, args);
                });
            }
        });
    });


    /**
     * 判断 hashbang 部分是否合法
     * @param {*} part
     * @returns {boolean}
     * @private
     */
    function _isSafePart(part) {
        return part === 'path' || part === 'query';
    }


//    /**
//     * 数据是否安全
//     * @param {*} object
//     * @returns {Boolean|String} 如果安全返回true，否则返回数据类型
//     * @private
//     */
//    function _isSafeVal(object) {
//        var type = data.type(object);
//        var ret = type === 'string' || type === 'boolean' || type === 'number' && isFinite(object);
//
//        return ret === !0 ? !0 : type;
//    }


    /**
     * 编码
     * @param {String} string 字符串
     * @returns {string}
     * @private
     */
    function _encode(string) {
        return encodeURIComponent(string);
    }

    /**
     * 解码
     * @param {String} string 字符串
     * @returns {string}
     * @private
     */
    function _decode(string) {
        try {
            return decodeURIComponent(string);
        } catch (err) {
            return '';
        }
    }

    /**
     * 比较两个对象的一级键值，返回不全等值的键
     * @param {Object} obj1 对象1
     * @param {Object} obj2 对象2
     * @returns {Array}
     * @private
     */
    function _differentKeys(obj1, obj2) {
        var keys = [];

        data.each(obj1, function (key, val) {
            if (!obj2 || val !== obj2[key]) {
                keys.push(key);
            }
        });

        data.each(obj2, function (key, val) {
            if (val !== obj1[key] && keys.indexOf(key) === -1) {
                keys.push(key);
            }
        });

        return keys;
    }
});