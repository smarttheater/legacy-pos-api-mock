"use strict";
const ttts_domain_1 = require("@motionpicture/ttts-domain");
const ttts_domain_2 = require("@motionpicture/ttts-domain");
const Util = require("../../../../common/Util/Util");
const BaseController_1 = require("../BaseController");
const conf = require("config");
const crypto = require("crypto");
const fs = require("fs-extra");
const mongoose = require("mongoose");
const MONGOLAB_URI = conf.get('mongolab_uri');
/**
 * 内部関係者タスクコントローラー
 *
 * @export
 * @class StaffController
 * @extends {BaseController}
 */
class StaffController extends BaseController_1.default {
    createFromJson() {
        mongoose.connect(MONGOLAB_URI, {});
        fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/staffs.json`, 'utf8', (err, data) => {
            if (err)
                throw err;
            const staffs = JSON.parse(data);
            // あれば更新、なければ追加
            const promises = staffs.map((staff) => {
                // パスワードハッシュ化
                const SIZE = 64;
                const passwordSalt = crypto.randomBytes(SIZE).toString('hex');
                staff.password_salt = passwordSalt;
                staff.password_hash = Util.createHash(staff.password, passwordSalt);
                return new Promise((resolve, reject) => {
                    this.logger.debug('updating staff...');
                    ttts_domain_1.Models.Staff.findOneAndUpdate({
                        user_id: staff.user_id
                    }, staff, {
                        new: true,
                        upsert: true
                    }, (updateErr) => {
                        this.logger.debug('staff updated', updateErr);
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
    /**
     * スクリーン指定で内部関係者の先抑えを実行する
     */
    createReservationsFromJson() {
        mongoose.connect(MONGOLAB_URI, {});
        // スクリーンごとに内部予約を追加する
        ttts_domain_1.Models.Screen.distinct('_id', (err, screenIds) => {
            if (err) {
                this.logger.info('screen ids found.', err);
                mongoose.disconnect();
                process.exit(0);
                return;
            }
            let i = 0;
            const next = () => {
                if (i < screenIds.length) {
                    this.logger.debug('createStaffReservationsByScreenId processing...', screenIds[i].toString());
                    this.createReservationsByScreenId(screenIds[i].toString(), (createErr) => {
                        this.logger.debug('createStaffReservationsByScreenId processed.', createErr);
                        i += 1;
                        next();
                    });
                }
                else {
                    this.logger.info('end.');
                    mongoose.disconnect();
                    process.exit(0);
                }
            };
            next();
        });
    }
    createReservationsByScreenId(screenId, cb) {
        fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/staffReservations_${screenId}.json`, 'utf8', (err, data) => {
            if (err) {
                this.logger.info('no reservations.');
                return cb(null);
            }
            // 内部関係者をすべて取得
            ttts_domain_1.Models.Staff.find({}, (findErr, staffs) => {
                if (findErr)
                    throw findErr;
                const staffsByName = {};
                for (const staff of staffs) {
                    staffsByName[staff.get('name')] = staff;
                }
                ttts_domain_2.ReservationUtil.publishPaymentNo((publishErr, paymentNo) => {
                    this.logger.debug('paymentNo is', paymentNo);
                    if (publishErr)
                        return cb(publishErr);
                    let reservations = [];
                    // スクリーンのパフォーマンスをすべて取得
                    ttts_domain_1.Models.Performance.find({ screen: screenId })
                        .populate('film', 'name is_mx4d copyright')
                        .populate('screen', 'name')
                        .populate('theater', 'name address')
                        .exec((findPerformancesErr, performances) => {
                        if (findPerformancesErr)
                            return cb(findPerformancesErr);
                        for (const performance of performances) {
                            let reservationsByPerformance = JSON.parse(data);
                            reservationsByPerformance = reservationsByPerformance.map((reservation, index) => {
                                const staffOfReservation = staffsByName[reservation.staff_name];
                                return {
                                    performance: performance.get('_id'),
                                    seat_code: reservation.seat_code,
                                    status: ttts_domain_2.ReservationUtil.STATUS_RESERVED,
                                    staff: staffOfReservation.get('_id'),
                                    staff_user_id: staffOfReservation.get('user_id'),
                                    staff_email: staffOfReservation.get('email'),
                                    staff_name: staffOfReservation.get('name'),
                                    staff_signature: 'system',
                                    entered: false,
                                    updated_user: 'system',
                                    purchased_at: Date.now(),
                                    watcher_name_updated_at: Date.now(),
                                    watcher_name: '',
                                    film_copyright: performance.get('film').get('copyright'),
                                    film_is_mx4d: performance.get('film').get('is_mx4d'),
                                    film_image: `https://${conf.get('dns_name')}/images/film/${performance.get('film').get('_id')}.jpg`,
                                    film_name_en: performance.get('film').get('name.en'),
                                    film_name_ja: performance.get('film').get('name.ja'),
                                    film: performance.get('film').get('_id'),
                                    screen_name_en: performance.get('screen').get('name.en'),
                                    screen_name_ja: performance.get('screen').get('name.ja'),
                                    screen: performance.get('screen').get('_id'),
                                    theater_name_en: performance.get('theater').get('name.en'),
                                    theater_name_ja: performance.get('theater').get('name.ja'),
                                    theater_address_en: performance.get('theater').get('address.en'),
                                    theater_address_ja: performance.get('theater').get('address.ja'),
                                    theater: performance.get('theater').get('_id'),
                                    performance_canceled: performance.get('canceled'),
                                    performance_end_time: performance.get('end_time'),
                                    performance_start_time: performance.get('start_time'),
                                    performance_open_time: performance.get('open_time'),
                                    performance_day: performance.get('day'),
                                    purchaser_group: ttts_domain_2.ReservationUtil.PURCHASER_GROUP_STAFF,
                                    payment_no: paymentNo,
                                    payment_seat_index: index,
                                    charge: 0,
                                    ticket_type_charge: 0,
                                    ticket_type_name_en: 'Free',
                                    ticket_type_name_ja: '無料',
                                    ticket_type_code: '00',
                                    seat_grade_additional_charge: 0,
                                    seat_grade_name_en: 'Normal Seat',
                                    seat_grade_name_ja: 'ノーマルシート'
                                };
                            });
                            reservations = reservations.concat(reservationsByPerformance);
                        }
                        this.logger.debug('creating staff reservations...length:', reservations.length);
                        ttts_domain_1.Models.Reservation.insertMany(reservations, (insertErr) => {
                            this.logger.debug('staff reservations created.', insertErr);
                            cb(err);
                        });
                    });
                });
            });
        });
    }
    /**
     * パフォーマンス指定で内部関係者の先抑えを行う
     *
     * @param {string} performanceId
     */
    createReservationsByPerformanceId(performanceId) {
        mongoose.connect(MONGOLAB_URI, {});
        ttts_domain_1.Models.Performance.findOne({ _id: performanceId })
            .populate('film', 'name is_mx4d copyright')
            .populate('screen', 'name')
            .populate('theater', 'name address')
            .exec((err, performance) => {
            if (err)
                throw err;
            if (!performance) {
                this.logger.info('no performance.');
                mongoose.disconnect();
                process.exit(0);
                return;
            }
            fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/staffReservations_${performance.get('screen').get('_id').toString()}.json`, 'utf8', (readFileerr, data) => {
                if (readFileerr) {
                    this.logger.info('no reservations.');
                    mongoose.disconnect();
                    process.exit(0);
                    return;
                }
                // 内部関係者をすべて取得
                ttts_domain_1.Models.Staff.find({}, (findStaffsErr, staffs) => {
                    if (findStaffsErr)
                        throw findStaffsErr;
                    const staffsByName = {};
                    for (const staff of staffs) {
                        staffsByName[staff.get('name')] = staff;
                    }
                    ttts_domain_2.ReservationUtil.publishPaymentNo((publishErr, paymentNo) => {
                        this.logger.info('paymentNo published.', publishErr, paymentNo);
                        if (publishErr) {
                            mongoose.disconnect();
                            process.exit(0);
                            return;
                        }
                        const reservations = JSON.parse(data);
                        const promises = reservations.map((reservation, index) => {
                            const staffOfReservation = staffsByName[reservation.staff_name];
                            const newReservation = {
                                performance: performance.get('_id'),
                                seat_code: reservation.seat_code,
                                status: ttts_domain_2.ReservationUtil.STATUS_RESERVED,
                                staff: staffOfReservation.get('_id'),
                                staff_user_id: staffOfReservation.get('user_id'),
                                staff_email: staffOfReservation.get('email'),
                                staff_name: staffOfReservation.get('name'),
                                staff_signature: 'system',
                                entered: false,
                                updated_user: 'system',
                                purchased_at: Date.now(),
                                watcher_name_updated_at: Date.now(),
                                watcher_name: '',
                                film_copyright: performance.get('film').get('copyright'),
                                film_is_mx4d: performance.get('film').get('is_mx4d'),
                                film_image: `https://${conf.get('dns_name')}/images/film/${performance.get('film').get('_id')}.jpg`,
                                film_name_en: performance.get('film').get('name.en'),
                                film_name_ja: performance.get('film').get('name.ja'),
                                film: performance.get('film').get('_id'),
                                screen_name_en: performance.get('screen').get('name.en'),
                                screen_name_ja: performance.get('screen').get('name.ja'),
                                screen: performance.get('screen').get('_id'),
                                theater_name_en: performance.get('theater').get('name.en'),
                                theater_name_ja: performance.get('theater').get('name.ja'),
                                theater_address_en: performance.get('theater').get('address.en'),
                                theater_address_ja: performance.get('theater').get('address.ja'),
                                theater: performance.get('theater').get('_id'),
                                performance_canceled: performance.get('canceled'),
                                performance_end_time: performance.get('end_time'),
                                performance_start_time: performance.get('start_time'),
                                performance_open_time: performance.get('open_time'),
                                performance_day: performance.get('day'),
                                purchaser_group: ttts_domain_2.ReservationUtil.PURCHASER_GROUP_STAFF,
                                payment_no: paymentNo,
                                payment_seat_index: index,
                                charge: 0,
                                ticket_type_charge: 0,
                                ticket_type_name_en: 'Free',
                                ticket_type_name_ja: '無料',
                                ticket_type_code: '00',
                                seat_grade_additional_charge: 0,
                                seat_grade_name_en: 'Normal Seat',
                                seat_grade_name_ja: 'ノーマルシート'
                            };
                            return new Promise((resolve) => {
                                this.logger.info('creating reservation...');
                                ttts_domain_1.Models.Reservation.create([newReservation], (createErr) => {
                                    this.logger.info('reservation created.', err);
                                    // 途中で終了しないように。最後まで予約渡来し続ける。
                                    resolve(createErr);
                                });
                            });
                        });
                        Promise.all(promises).then((result) => {
                            this.logger.info('promised', result);
                            mongoose.disconnect();
                            process.exit(0);
                        });
                    });
                });
            });
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = StaffController;
