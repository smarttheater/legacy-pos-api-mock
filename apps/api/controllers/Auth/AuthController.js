/**
 * 認証コントローラー
 *
 * @namespace OtherController
 */
"use strict";
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const crypto = require("crypto");
/**
 * ログイン
 */
// tslint:disable-next-line:variable-name
function login(_req, res) {
    const SIZE = 64;
    const token = crypto.randomBytes(SIZE).toString('hex');
    ttts_domain_1.Models.Authentication.findOneAndUpdate({
        mvtk_kiin_cd: '00000775' // テスト用会員コード
    }, {
        token: token
    }, {
        upsert: true,
        new: true
    }, (err, authentication) => {
        if (err) {
            res.json({
                success: false,
                access_token: null,
                mvtk_kiin_cd: null
            });
        }
        else {
            res.json({
                success: true,
                access_token: authentication.get('token'),
                mvtk_kiin_cd: authentication.get('mvtk_kiin_cd') // テスト用会員コード
            });
        }
    });
}
exports.login = login;
