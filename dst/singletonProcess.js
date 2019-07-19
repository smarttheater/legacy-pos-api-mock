"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Singletonプロセス管理
 */
const ttts = require("@tokyotower/domain");
const createDebug = require("debug");
const moment = require("moment");
const os = require("os");
const util = require("util");
const debug = createDebug('ttts-api:singletonProcess');
const redisClient = ttts.redis.createClient({
    host: process.env.REDIS_HOST,
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
const processId = util.format('%s:%s:%s', os.hostname, process.pid, moment()
    .valueOf());
/**
 * Signletonプロセスをロックする
 */
function lock(params) {
    return __awaiter(this, void 0, void 0, function* () {
        // ロック処理
        const key = `api:${(params.project !== undefined) ? params.project.id : 'undefined'}:singletonProcess:${params.key}`;
        const value = processId;
        const ttl = params.ttl;
        let locked = false;
        let self = false;
        // ロックトライ
        debug('locking singleton process...', key, value);
        locked = yield new Promise((resolve) => {
            redisClient.multi()
                .setnx(key, value)
                .ttl(key)
                .expire(key, ttl)
                .exec((_, results) => {
                debug('setnx ttl expire', results);
                if (!Array.isArray(results)) {
                    resolve(false);
                    return;
                }
                if (results[0] === 1) {
                    resolve(true);
                    return;
                }
                // すでにキーが存在していた場合期限を戻す
                debug('setting expire to previous value...', key, results[1]);
                redisClient.expire(key, results[1], () => {
                    resolve(false);
                });
            });
        });
        debug('locked:', locked, key);
        if (!locked) {
            // ロックプロセス自身かどうか確認
            self = yield new Promise((resolve) => {
                redisClient.get(key, (_, result) => {
                    debug('locked by', result, key);
                    resolve(result === value);
                });
            });
            debug('self:', self, key);
        }
        if (self) {
            // ロックプロセス自身であれば期限更新
            debug('setting expire...', self, key);
            locked = yield new Promise((resolve) => {
                redisClient.expire(key, ttl, (_, result) => {
                    resolve(result === 1);
                });
            });
            debug('expire set', self, key);
        }
        return locked;
    });
}
exports.lock = lock;