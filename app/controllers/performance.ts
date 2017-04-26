/**
 * パフォーマンスコントローラー
 *
 * @namespace PerformanceController
 */

import { Models, PerformanceStatusesModel } from '@motionpicture/chevre-domain';
import * as createDebug from 'debug';
import { Request, Response } from 'express';
import * as moment from 'moment';
import * as _ from 'underscore';

const debug = createDebug('chevre-api:controller:performance');

const DEFAULT_RADIX = 10;

/**
 * 検索する
 *
 * @memberOf PerformanceController
 */
// tslint:disable-next-line:cyclomatic-complexity
export async function search(req: Request, res: Response) {
    try {
        // tslint:disable-next-line:max-line-length
        const limit: number | null = (!_.isEmpty(req.query.limit)) ? parseInt(req.query.limit, DEFAULT_RADIX) : null;
        const page: number = (!_.isEmpty(req.query.page)) ? parseInt(req.query.page, DEFAULT_RADIX) : 1;

        // 上映日
        const day: string | null = (!_.isEmpty(req.query.day)) ? req.query.day : null;
        // 部門
        const section: string | null = (!_.isEmpty(req.query.section)) ? req.query.section : null;
        // フリーワード
        const words: string | null = (!_.isEmpty(req.query.words)) ? req.query.words : null;
        // この時間以降開始のパフォーマンスに絞る(timestamp milliseconds)
        // tslint:disable-line:max-line-length
        const startFrom: number | null = (!_.isEmpty(req.query.start_from)) ? parseInt(req.query.start_from, DEFAULT_RADIX) : null;
        // 劇場
        const theater: string | null = (!_.isEmpty(req.query.theater)) ? req.query.theater : null;
        // スクリーン
        const screen: string | null = (!_.isEmpty(req.query.screen)) ? req.query.screen : null;

        // 検索条件を作成
        let andConditions: any[] = [
            { canceled: false }
        ];

        if (day !== null) {
            andConditions.push({
                day: day
            });
        }

        if (theater !== null) {
            andConditions.push({
                theater: theater
            });
        }

        if (screen !== null) {
            andConditions.push({
                screen: screen
            });
        }

        if (startFrom !== null) {
            const now = moment(startFrom);
            // tslint:disable-next-line:no-magic-numbers
            const tomorrow = moment(startFrom).add(+24, 'hours');

            andConditions.push({
                $or: [
                    {
                        day: now.format('YYYYMMDD'),
                        start_time: {
                            $gte: now.format('HHmm')
                        }
                    },
                    {
                        day: {
                            $gte: tomorrow.format('YYYYMMDD')
                        }
                    }
                ]
            });
        }

        // 作品条件を追加する
        // tslint:disable-next-line:max-func-body-length no-shadowed-variable
        andConditions = await addFilmConditions(andConditions, section, words);

        let conditions: any = null;
        if (andConditions.length > 0) {
            conditions = {
                $and: andConditions
            };
        }

        // 作品件数取得
        const filmIds = await Models.Performance.distinct('film', conditions).exec();

        // 総数検索
        const performancesCount = await Models.Performance.count(conditions).exec();

        // 必要な項目だけ指定すること(レスポンスタイムに大きく影響するので)
        debug('locale is', req.getLocale());
        let fields = '';
        if (req.getLocale() === 'ja') {
            fields = 'day open_time start_time film screen screen_name.ja theater theater_name.ja';
        } else {
            fields = 'day open_time start_time film screen screen_name.en theater theater_name.en';
        }
        const query = Models.Performance.find(
            conditions,
            fields
        );

        if (limit !== null) {
            query.skip(limit * (page - 1)).limit(limit);
        }

        if (req.getLocale() === 'ja') {
            query.populate('film', 'name.ja sections.name.ja minutes copyright');
        } else {
            query.populate('film', 'name.en sections.name.en minutes copyright');
        }

        // 上映日、開始時刻
        query.setOptions({
            sort: {
                day: 1,
                start_time: 1
            }
        });

        const performances = <any[]>await query.lean(true).exec();

        // 空席情報を追加
        const performanceStatuses = await PerformanceStatusesModel.find();

        const results = performances.map((performance) => {
            return {
                _id: performance._id,
                day: performance.day,
                open_time: performance.open_time,
                start_time: performance.start_time,
                seat_status: (performanceStatuses !== undefined) ? performanceStatuses.getStatus(performance._id.toString()) : null,
                theater_name: performance.theater_name[req.getLocale()],
                screen_name: performance.screen_name[req.getLocale()],
                film_id: performance.film._id,
                film_name: performance.film.name[req.getLocale()],
                film_sections: performance.film.sections.map((filmSection: any) => filmSection.name[req.getLocale()]),
                film_minutes: performance.film.minutes,
                film_copyright: performance.film.copyright,
                film_image: `${process.env.FRONTEND_ENDPOINT}/images/film/${performance.film._id}.jpg`
            };
        });

        res.json({
            success: true,
            results: results,
            performances_count: performancesCount,
            films_count: filmIds.length
        });
    } catch (error) {
        console.error(error);
        res.json({
            success: false,
            results: [],
            performances_count: 0,
            films_count: 0
        });
    }
}

async function addFilmConditions(andConditions: any[], section: string | null, words: string | null): Promise<any[]> {
    const filmAndConditions: any[] = [];
    if (section !== null) {
        // 部門条件の追加
        filmAndConditions.push({
            'sections.code': { $in: [section] }
        });
    }

    // フリーワードの検索対象はタイトル(日英両方)
    // 空白つなぎでOR検索
    if (words !== null) {
        // trim and to half-width space
        words = words.replace(/(^\s+)|(\s+$)/g, '').replace(/\s/g, ' ');
        const regexes = words.split(' ').filter((value) => (value.length > 0));

        const orConditions = [];
        for (const regex of regexes) {
            orConditions.push(
                {
                    'name.ja': { $regex: `${regex}` }
                },
                {
                    'name.en': { $regex: `${regex}` }
                }
            );
        }

        filmAndConditions.push({
            $or: orConditions
        });
    }

    if (filmAndConditions.length > 0) {
        const filmConditions = {
            $and: filmAndConditions
        };

        try {
            const filmIds = await Models.Film.distinct(
                '_id',
                filmConditions
            ).exec();

            if (filmIds.length > 0) {
                andConditions.push({
                    film: {
                        $in: filmIds
                    }
                });
            } else {
                // 検索結果のない条件を追加
                andConditions.push({
                    film: null
                });
            }

            return andConditions;
        } catch (error) {
            // 検索結果のない条件を追加
            andConditions.push({
                film: null
            });

            throw error;
        }
    } else {
        // 全作品数を取得
        return andConditions;
    }
}
