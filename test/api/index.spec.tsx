import { configureStore } from '@reduxjs/toolkit';
import type { Api } from '@reduxjs/toolkit/query';

import { ANY, expectType } from '../helpers';
import { fetch } from '../../src/api';

const originalEnv = process.env.NODE_ENV;
beforeAll(() => void ((process.env as any).NODE_ENV = 'development'));
afterAll(() => void ((process.env as any).NODE_ENV = originalEnv));

let spy: jest.SpyInstance;
beforeAll(() => {
  spy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  spy.mockReset();
});
afterAll(() => {
  spy.mockRestore();
});

test('sensible defaults', () => {
  const { api, get } = fetch('user');
  const UserApi = api({
    get: get<any, number>((id) => ({ url: `user/${id}` })),
  });

  configureStore({
    reducer: {
      [UserApi.reducerPath]: UserApi.reducer,
    },
    middleware: (gDM) => gDM().concat(UserApi.middleware),
  });

  expect(UserApi.reducerPath).toBe('userApi');

  type TagTypes = typeof api extends Api<any, any, any, infer E> ? E : 'no match';
  expectType<TagTypes>(ANY as never);
  // @ts-expect-error must have tags
  expectType<TagTypes>(0);
});
