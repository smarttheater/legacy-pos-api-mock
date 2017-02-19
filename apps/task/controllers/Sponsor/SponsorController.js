"use strict";
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const Util = require("../../../../common/Util/Util");
const BaseController_1 = require("../BaseController");
const conf = require("config");
const crypto = require("crypto");
const fs = require("fs-extra");
const mongoose = require("mongoose");
const MONGOLAB_URI = conf.get('mongolab_uri');
/**
 * 外部関係者タスクコントローラー
 *
 * @export
 * @class SponsorController
 * @extends {BaseController}
 */
class SponsorController extends BaseController_1.default {
    createFromJson() {
        mongoose.connect(MONGOLAB_URI, {});
        fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/sponsors.json`, 'utf8', (err, data) => {
            if (err)
                throw err;
            const sponsors = JSON.parse(data);
            // あれば更新、なければ追加
            const promises = sponsors.map((sponsor) => {
                // パスワードハッシュ化
                const SIZE = 64;
                const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
                sponsor.password_salt = passwordSalt;
                sponsor.password_hash = Util.createHash(sponsor.password, passwordSalt);
                return new Promise((resolve, reject) => {
                    this.logger.debug('updating sponsor...');
                    ttts_domain_1.Models.Sponsor.findOneAndUpdate({
                        user_id: sponsor.user_id
                    }, sponsor, {
                        new: true,
                        upsert: true
                    }, (updateErr) => {
                        this.logger.debug('sponsor updated', updateErr);
                        (err) ? reject(err) : resolve();
                    });
                });
            });
            Promise.all(promises).then(() => {
                this.logger.info('promised.');
                mongoose.disconnect();
                process.exit(0);
            }, (promiseErr) => {
                this.logger.error('promised.', promiseErr);
                mongoose.disconnect();
                process.exit(0);
            });
        });
    }
    // tslint:disable-next-line:prefer-function-over-method
    createPasswords() {
        const file = `${__dirname}/../../../../data/${process.env.NODE_ENV}/sponsorPasswords.txt`;
        const passwords = [];
        const l = 8;
        const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const cl = c.length;
        const NUMBER_OF_PASSWORD = 300;
        while (passwords.length < NUMBER_OF_PASSWORD) {
            let password = '';
            // 数字を含むパスワードが生成されるまで繰り返す
            while (password.length < l || !password.match(/[0-9]+/g)) {
                if (password.length >= l) {
                    password = '';
                }
                // tslint:disable-next-line:insecure-random
                password += c[Math.floor(Math.random() * cl)];
            }
            console.log(password);
            passwords.push(password);
        }
        fs.writeFileSync(file, passwords.join('\n'), 'utf8');
        process.exit(0);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SponsorController;
