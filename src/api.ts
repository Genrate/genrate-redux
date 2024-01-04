import {
  createApi,
  CreateApiOptions,
  EndpointDefinitions,
  QueryDefinition,
  MutationDefinition,
  BaseQueryFn,
  fetchBaseQuery,
  retry,
} from '@reduxjs/toolkit/query/react';

import { FetchBaseQueryArgs } from '@reduxjs/toolkit/dist/query/fetchBaseQuery';
import {
  EndpointBuilder,
  EndpointDefinition,
  MutationExtraOptions,
  QueryExtraOptions,
  ResultDescription,
} from '@reduxjs/toolkit/dist/query/endpointDefinitions';
import {
  BaseQueryApi,
  BaseQueryArg,
  BaseQueryError,
  BaseQueryExtraOptions,
  BaseQueryMeta,
  BaseQueryResult,
  QueryReturnValue,
} from '@reduxjs/toolkit/dist/query/baseQueryTypes';
import { MaybePromise, OmitFromUnion } from '@reduxjs/toolkit/dist/query/tsHelpers';

type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestFn<
  Q extends BaseQueryFn,
  T extends string,
  RP extends string,
  B extends EndpointBuilder<Q, T, RP>,
  FN extends <R, P>(build: B) => EndpointDefinition<P, Q, T, R, RP>,
> = FN;

type CustomDefinitions<BQ extends BaseQueryFn, Q extends Record<string, any>> = {
  [k in keyof Q]: ReturnType<RequestFn<BQ, string, string, EndpointBuilder<BQ, string, string>, Q[k]>>;
};

export function request<N extends string, BQ extends BaseQueryFn>(name: N, baseQuery: BQ) {
  const query =
    (method: Method) =>
    <R, P>(
      query: (arg: P) => BaseQueryArg<BQ>,
      options?: QueryExtraOptions<string, R, P, BQ, string> & {
        transform?: (baseQueryReturnValue: BaseQueryResult<BQ>, meta: BaseQueryMeta<BQ>, arg: P) => R | Promise<R>;
        tags?: ResultDescription<string, R, P, BaseQueryError<BQ>, BaseQueryMeta<BQ>>;
        extra?: BaseQueryExtraOptions<BQ>;
        sharing?: boolean;
      }
    ) =>
    (build: EndpointBuilder<BQ, string, string>) =>
      build.query<R, P>({
        query: (arg: P) => {
          const res = query(arg);
          return (typeof res == 'string' ? { url: res, method } : { ...res, method }) as BaseQueryArg<BQ>;
        },
        ...options,
        transformResponse: options?.transform,
        providesTags: options?.tags,
        extraOptions: options?.extra,
        structuralSharing: options?.sharing ?? true,
      } as OmitFromUnion<QueryDefinition<P, BQ, string, R, string>, 'type'>);

  const queryFn =
    <R, P>(
      queryFn: (
        arg: P,
        api: BaseQueryApi,
        extraOptions: BaseQueryExtraOptions<BQ>,
        baseQuery: (arg: Parameters<BQ>[0]) => ReturnType<BQ>
      ) => MaybePromise<QueryReturnValue<R, BaseQueryError<BQ>>>,
      options?: QueryExtraOptions<string, R, P, BQ, string> & {
        sharing: boolean;
      }
    ) =>
    (build: EndpointBuilder<BQ, string, string>) =>
      build.query<R, P>({ queryFn, ...options, structuralSharing: options?.sharing } as OmitFromUnion<
        QueryDefinition<P, BQ, string, R, string>,
        'type'
      >);

  const mutate = (method: string) => {
    return <R, P>(
        query: (arg: P) => BaseQueryArg<BQ>,
        options?: MutationExtraOptions<string, R, P, BQ, string> & {
          transform?: (baseQueryReturnValue: BaseQueryResult<BQ>, meta: BaseQueryMeta<BQ>, arg: P) => R | Promise<R>;
          tags?: ResultDescription<string, R, P, BaseQueryError<BQ>, BaseQueryMeta<BQ>>;
          extra?: BaseQueryExtraOptions<BQ>;
          sharing?: boolean;
        }
      ) =>
      (build: EndpointBuilder<BQ, string, string>) => {
        return build.mutation<R, P>({
          query: (arg) => {
            const res = query(arg);
            return typeof res == 'string' ? { url: res, method } : { ...res, method };
          },
          ...options,
          transformResponse: options?.transform,
          invalidatesTags: options?.tags,
          extraOptions: options?.extra,
          structuralSharing: options?.sharing ?? true,
        } as OmitFromUnion<MutationDefinition<P, BQ, string, R, string>, 'type'>);
      };
  };

  return {
    api<
      Q extends Record<string, any>,
      Options extends Omit<CreateApiOptions<BQ, EndpointDefinitions, string, string>, 'endpoints' | 'baseQuery'>,
    >(queries: Q, options?: Options) {
      const reducerPath = options?.reducerPath ?? `${name}Api`;
      return createApi({
        reducerPath,
        baseQuery,
        endpoints: (build) => {
          const definitions = {} as CustomDefinitions<BQ, Q>;

          for (const q in queries) {
            definitions[q] = queries[q](build);
          }

          return definitions;

          // return getDefs({}, queries, Object.keys(queries), build)
        },
        ...options,
      });
    },
    query,
    mutate,
    queryFn,
    get: query('GET'),
    post: mutate('POST'),
    patch: mutate('PATCH'),
    put: mutate('PUT'),
    del: mutate('DELETE'),
  };
}

export function fetch<N extends string>(
  name: N,
  baseUrl = '/',
  options?: Omit<FetchBaseQueryArgs, 'baseUrl'>,
  maxRetries = 3
) {
  const baseQuery = fetchBaseQuery({ baseUrl, ...options } as FetchBaseQueryArgs);
  const baseQueryWithRetry = retry(baseQuery, { maxRetries });

  return request(name, baseQueryWithRetry);
}
