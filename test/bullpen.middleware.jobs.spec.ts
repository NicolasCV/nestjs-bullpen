import { BullpenMiddleware } from '../src/bullpen.middleware';

function makeMiddleware() {
  const listJobs = jest.fn().mockResolvedValue([]);
  const actions = { listJobs } as any;
  const discovery = { getQueue: () => ({}), getQueueNames: () => ['emails'] } as any;
  const topology = {} as any;
  const authGuard = { canActivate: jest.fn().mockResolvedValue(true) } as any;
  const options = { route: '/admin/queues', writable: true } as any;
  return {
    middleware: new BullpenMiddleware(options, actions, discovery, topology, authGuard),
    listJobs,
  };
}

async function callJobs(middleware: BullpenMiddleware, querystring: string) {
  const url = `/admin/queues/api/queues/emails/jobs${querystring}`;
  const res = {
    headersSent: false,
    statusCode: 0,
    setHeader: jest.fn(),
    end: jest.fn(),
  } as any;
  await middleware.use({ method: 'GET', url, originalUrl: url, headers: {} } as any, res, () => {
    throw new Error('next() should not be called for a matched route');
  });
  return res;
}

describe('BullpenMiddleware jobs branch (scale-safe contract)', () => {
  it('defaults to pageSize 25 and page 0 -> start=0 end=24', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 0, 24);
  });

  it('maps page*size to start and page*size+size-1 to end', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active&page=3&pageSize=50');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 150, 199);
  });

  it('clamps pageSize to a maximum of 100 (never an unbounded range)', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active&page=0&pageSize=10000');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 0, 99);
  });

  it('clamps pageSize to a minimum of 1', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active&page=2&pageSize=0');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 2, 2);
  });

  it('floors a negative page at 0', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active&page=-5&pageSize=25');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 0, 24);
  });

  it('falls back to pageSize 25 when the value is not a number', async () => {
    const { middleware, listJobs } = makeMiddleware();
    await callJobs(middleware, '?status=active&pageSize=abc');
    expect(listJobs).toHaveBeenCalledWith('emails', 'active', 0, 24);
  });
});
