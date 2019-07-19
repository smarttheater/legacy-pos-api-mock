/**
 * GMO実売上
 */
import * as ttts from '@tokyotower/domain';

import { connectMongo } from '../../../connectMongo';

import * as singletonProcess from '../../../singletonProcess';

export default async (params: {
    project?: ttts.factory.project.IProject;
}) => {
    let holdSingletonProcess = false;
    setInterval(
        async () => {
            holdSingletonProcess = await singletonProcess.lock({
                project: params.project,
                key: 'settleCreditCard',
                ttl: 60
            });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });
    const redisClient = ttts.redis.createClient(
        {
            host: <string>process.env.REDIS_HOST,
            port: Number(<string>process.env.REDIS_PORT),
            password: <string>process.env.REDIS_KEY,
            tls: { servername: <string>process.env.REDIS_HOST }
        }
    );
    const taskRepo = new ttts.repository.Task(connection);

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 1000;

    setInterval(
        async () => {
            if (!holdSingletonProcess) {
                return;
            }

            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await ttts.service.task.executeByName(
                    ttts.factory.taskName.SettleCreditCard
                )(taskRepo, connection, redisClient);
            } catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
