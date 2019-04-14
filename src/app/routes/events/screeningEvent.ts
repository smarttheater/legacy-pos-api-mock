/**
 * 上映イベントルーター
 */
import * as ttts from '@motionpicture/ttts-domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';

import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const screeningEventRouter = Router();

/**
 * イベント検索
 */
screeningEventRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    ...[
        query('inSessionFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('inSessionThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.availableFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.availableThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.validFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.validThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (_, res, next) => {
        try {
            res.set('X-Total-Count', '0')
                .json([]);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでイベント検索
 */
screeningEventRouter.get(
    '/:id',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const repo = new ttts.repository.Performance(ttts.mongoose.connection);
            const performance = await repo.findById(req.params.id);
            const event = performance2event(performance);

            res.json(event);
        } catch (error) {
            next(error);
        }
    }
);

function performance2event(performance: ttts.factory.performance.IPerformanceWithDetails): any {
    return {
        ...performance,
        typeOf: 'ScreeningEvent',
        additionalProperty: [],
        attendeeCount: 0,
        checkInCount: 0,
        doorTime: performance.door_time,
        endDate: performance.end_date,
        startDate: performance.start_date,
        eventStatus: (performance.canceled) ? 'EventCancelled' : 'EventScheduled',
        name: performance.film.name,
        offers: {
            id: performance.ticket_type_group.id,
            name: performance.ticket_type_group.name,
            typeOf: 'Offer',
            priceCurrency: 'JPY',
            eligibleQuantity: {
                unitCode: 'C62',
                typeOf: 'QuantitativeValue'
            },
            itemOffered: {
                serviceType: {
                    typeOf: 'ServiceType',
                    name: ''
                }
            }
        },
        location: {
            typeOf: 'ScreeningRoom',
            branchCode: performance.screen.id,
            name: performance.screen.name
        },
        superEvent: {
            id: '',
            name: performance.film.name,
            alternativeHeadline: performance.film.name,
            location: {
                id: performance.theater.id,
                branchCode: performance.theater.id,
                name: performance.theater.name,
                typeOf: 'MovieTheater'
            },
            videoFormat: [],
            soundFormat: [],
            workPerformed: {
                identifier: performance.film.id,
                name: performance.film.name.ja,
                typeOf: 'Movie'
            },
            offers: {
                typeOf: 'Offer',
                priceCurrency: 'JPY'
            },
            additionalProperty: [],
            eventStatus: 'EventScheduled',
            typeOf: 'ScreeningEventSeries'
        },
        workPerformed: {
            identifier: performance.film.id,
            name: performance.film.name.ja,
            typeOf: 'Movie'
        }
    };
}

/**
 * イベントに対するオファー検索
 */
screeningEventRouter.get(
    '/:id/offers',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    validator,
    async (_, res, next) => {
        try {
            res.json([]);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * イベントに対する券種オファー検索
 */
screeningEventRouter.get(
    '/:id/offers/ticket',
    permitScopes(['aws.cognito.signin.user.admin', 'events', 'events.read-only']),
    ...[
        query('seller')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        query('store')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (_, res, next) => {
        try {
            res.json([]);
        } catch (error) {
            next(error);
        }
    }
);

export default screeningEventRouter;
